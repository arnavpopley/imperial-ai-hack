// Student routes (spec 13). Every body is validated with the shared zod schemas.
import { schemas, type Evidence, type Feedback, type FeedbackBody, type ProfileEditBody, type SessionState, type SseEvent } from '@modulematch/shared';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { draftWellbeing } from '../agents/escalation.ts';
import { extract, mergeUpdates } from '../agents/extractor.ts';
import { QUICK_PLAN } from '../agents/interviewer.ts';
import { answerModuleQuestion, moduleFacts } from '../agents/knowledge.ts';
import { emitWords } from '../agents/llm.ts';
import { catalogue, clearExplanationCache, explanationFor, moduleTitle, newSessionState, ranked, recommendationsResponse, saveProfile, setMode, timetableView, tracerSink } from '../agents/session.ts';
import { confirmProfile, handleTurn, resumeInterview } from '../agents/supervisor.ts';
import { rawModule } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';
import { WELLBEING_NOTICE } from '../guardrails/g4-wellbeing.ts';
import { runInputGuardrails } from '../guardrails/pipeline.ts';
import { cleanForStorage } from '../guardrails/stored-text.ts';
import { matchSocieties, pathwayProgress } from '../engines/index.ts';
import { createTracer } from '../trace/tracer.ts';
import { body } from './validate.ts';

/** Loads the session named in the path, or answers 404. */
function load(c: Context): SessionState | Response {
  const session = repo.getSession(c.req.param('id') ?? '');
  return session ?? c.json({ error: 'session not found' }, 404);
}

const fresh = (id: string) => repo.getSession(id)!;

/** Direct edits in "Your data" count as evidence, quoted as the student's own edit (spec 8.6 and 20.3). */
function editEvidence(sessionId: string, edits: ProfileEditBody): Evidence[] {
  const quote = 'Set by the student in Your data';
  const turnId = randomUUID();
  const item = (slot: string, value: Evidence['value']): Evidence => ({ id: randomUUID(), sessionId, turnId, slot, value, quote, confidence: 1 });
  return [
    ...Object.entries(edits.interests ?? {}).flatMap(([topic, v]) => (v > 0 ? [item(`interest:${topic}`, v)] : [])),
    ...Object.entries(edits.style ?? {}).flatMap(([k, v]) => (v === null || v === undefined ? [] : [item(`style.${k}`, v)])),
    ...(edits.breadthAppetite !== undefined && edits.breadthAppetite !== null ? [item('breadthAppetite', edits.breadthAppetite)] : []),
    ...(edits.pathways ? [item('pathways', edits.pathways)] : []),
    ...(edits.pathwaysSkipped !== undefined ? [item('pathwaysSkipped', edits.pathwaysSkipped)] : []),
    ...(edits.timetablePrefs?.avoidDays ? [item('timetablePrefs.avoidDays', edits.timetablePrefs.avoidDays)] : []),
  ];
}

/**
 * Counts profile deletions per session, so a feedback write that was waiting on the live text checks when the
 * student deleted their data is dropped rather than saved after the deletion (spec 20.3).
 */
const deletions = new Map<string, number>();

/** Checks that the rated answer exists: a stored assistant message in this session, or a known module. */
function feedbackTargetError(session: SessionState, target: FeedbackBody['target']): string | null {
  if (target.kind === 'message') {
    const found = session.messages.some((m) => m.id === target.id && m.role === 'assistant');
    return found ? null : 'answer not found in this session';
  }
  if (!target.moduleId) return 'moduleId is required for module answers, explanations and summaries';
  return catalogue.modules().some((m) => m.id === target.moduleId) ? null : 'unknown module';
}

/** Slots the student cleared (set to null or emptied), whose old evidence must no longer count (spec 8.6). */
function clearedSlots(edits: ProfileEditBody): string[] {
  return [
    ...Object.entries(edits.interests ?? {}).flatMap(([topic, v]) => (v === 0 ? [`interest:${topic}`] : [])),
    ...Object.entries(edits.style ?? {}).flatMap(([k, v]) => (v === null ? [`style.${k}`] : [])),
    ...(edits.breadthAppetite === null ? ['breadthAppetite'] : []),
    ...(edits.pathways?.length === 0 && !edits.pathwaysSkipped ? ['pathways', 'pathwaysSkipped'] : []),
  ];
}

export const studentRoutes = new Hono()
  .post('/', body(schemas.CreateSessionBody), (c) => {
    const state = newSessionState(c.req.valid('json'));
    repo.createSession(state);
    const tracer = createTracer(state.id, tracerSink);
    setMode(state, 'INTERVIEW', tracer, 'programme and year entered');
    // The interview opens with the first planned question, so the chat never starts empty.
    const first = QUICK_PLAN[0]!;
    repo.addMessage({ id: randomUUID(), sessionId: state.id, role: 'assistant', agent: 'interviewer', content: `Hi! A few quick questions so I can match modules to you. ${first.question}`, at: new Date().toISOString() });
    repo.updateSession(state.id, { interview: { ...state.interview, questionsAsked: 1, askedSteps: [first.id], targetSlots: first.slots } });
    return c.json(fresh(state.id), 201);
  })
  .get('/:id', (c) => {
    const session = load(c);
    return session instanceof Response ? session : c.json(session);
  })
  .post('/:id/messages', body(schemas.SendMessageBody), (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const input = c.req.valid('json');
    return streamSSE(c, async (stream) => {
      await handleTurn(session.id, input, (event) => stream.writeSSE({ event: event.type, data: JSON.stringify(event) })).catch(async (error: unknown) => {
        console.error(error);
        await stream.writeSSE({ event: 'token', data: JSON.stringify({ type: 'token', text: 'Sorry, something went wrong on my side. Please try again.', agent: 'supervisor' }) });
        // An empty messageId: this apology is not stored, so it cannot be rated.
        await stream.writeSSE({ event: 'done', data: JSON.stringify({ type: 'done', messageId: '', widget: null }) });
      });
    });
  })
  .put('/:id/profile', body(schemas.ProfileEditBody), (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const input = c.req.valid('json');
    const { confirm, resumeInterview: resume, style, timetablePrefs, ...edits } = input;
    const evidence = editEvidence(session.id, input);
    const cleared = clearedSlots(input);
    repo.deleteEvidenceForSlots(session.id, cleared);
    repo.addEvidence(evidence);
    session.evidence = [...session.evidence.filter((e) => !cleared.includes(e.slot)), ...evidence];
    const profile = {
      ...session.profile,
      ...Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== undefined)),
      style: { ...session.profile.style, ...style },
      timetablePrefs: { ...session.profile.timetablePrefs, ...timetablePrefs },
      ...(edits.pathways?.length ? { pathwaysSkipped: false } : {}),
      updatedAt: new Date().toISOString(),
    };
    session.profile = saveProfile(session, schemas.StudentProfile.parse(profile));
    clearExplanationCache();
    if (confirm) confirmProfile(session);
    if (resume) resumeInterview(session);
    return c.json(fresh(session.id));
  })
  .delete('/:id/profile', (c) => {
    // Spec 20.3: the student can delete everything held about them.
    const session = load(c);
    if (session instanceof Response) return session;
    deletions.set(session.id, (deletions.get(session.id) ?? 0) + 1);
    repo.deleteProfileAndEvidence(session.id);
    // A pending draft can quote the student, so it goes too.
    repo.updateSession(session.id, { escalationDraft: null });
    createTracer(session.id, tracerSink).record({ actor: 'supervisor', kind: 'agent', input: 'delete profile', output: 'profile and evidence deleted', verdict: null });
    clearExplanationCache();
    return c.json(fresh(session.id));
  })
  .put('/:id/weights', body(schemas.Weights), (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    session.weights = c.req.valid('json');
    repo.updateSession(session.id, { weights: session.weights });
    return c.json(recommendationsResponse(session));
  })
  .get('/:id/recommendations', (c) => {
    const session = load(c);
    return session instanceof Response ? session : c.json(recommendationsResponse(session));
  })
  .get('/:id/modules/:moduleId/explanation', async (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const explanation = await explanationFor(session, c.req.param('moduleId'), createTracer(session.id, tracerSink));
    if (!explanation) return c.json({ error: 'module not found' }, 404);
    const cited = new Set(explanation.because.flatMap((b) => (b.evidenceId ? [b.evidenceId] : [])));
    return c.json({ explanation, evidence: session.evidence.filter((e) => cited.has(e.id)) });
  })
  .post('/:id/shortlist', body(schemas.ShortlistBody), (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const { moduleId, action } = c.req.valid('json');
    if (!catalogue.modules().some((m) => m.id === moduleId)) return c.json({ error: 'unknown module' }, 400);
    const tracer = createTracer(session.id, tracerSink);
    if (action === 'add') {
      // The same eligibility gate as the chat: a module the advisor would refuse cannot be saved here either.
      const rec = ranked(session).find((r) => r.moduleId === moduleId);
      if (!rec?.eligible) {
        const reasons = rec?.ineligibleReasons ?? ['This module is already completed.'];
        tracer.record({ actor: 'G7 rules', kind: 'guardrail', input: `shortlist add ${moduleId}`, output: 'ineligible, not added', verdict: 'block' });
        return c.json({ error: 'not eligible', reasons }, 422);
      }
    }
    if (action === 'add') repo.addToShortlist(session.id, moduleId);
    else repo.removeFromShortlist(session.id, moduleId);
    tracer.record({ actor: 'supervisor', kind: 'tool', input: `shortlist ${action} ${moduleId}`, output: `${repo.listShortlist(session.id).length} on shortlist`, verdict: null });
    // Spec 12: PLAN returns to RECOMMEND when the shortlist is edited or a swap is accepted.
    if (session.mode === 'PLAN') setMode(session, 'RECOMMEND', tracer, 'shortlist edited');
    return c.json(fresh(session.id));
  })
  .get('/:id/timetable', (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    if (session.shortlist.length >= 2 && session.mode === 'RECOMMEND') {
      setMode(session, 'PLAN', createTracer(session.id, tracerSink), 'shortlist has two or more modules');
    }
    return c.json(timetableView(session));
  })
  .post('/:id/escalations', body(schemas.CreateEscalationBody), (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const { type, summary } = c.req.valid('json');
    const escalation = { id: randomUUID(), sessionId: session.id, type, summary, status: 'open' as const, staffResponse: null, createdAt: new Date().toISOString() };
    repo.createEscalation(escalation);
    repo.updateSession(session.id, { escalationDraft: null });
    const tracer = createTracer(session.id, tracerSink);
    tracer.record({ actor: 'supervisor', kind: 'escalation', input: type, output: 'approved by student and sent', verdict: 'escalate' });
    setMode(session, 'ESCALATED', tracer, 'escalation sent');
    return c.json(escalation, 201);
  })
  .get('/:id/pathways/:pathwayId/progress', (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const pathway = catalogue.pathways().find((p) => p.id === c.req.param('pathwayId'));
    if (!pathway) return c.json({ error: 'pathway not found' }, 404);
    return c.json(pathwayProgress(session.profile, pathway, catalogue.modules(), session.shortlist, ranked(session)));
  })
  .post('/:id/modules/:moduleId/ask', body(schemas.AskModuleBody), (c) => {
    // The module knowledge agent: answers from one module's record and public page, after the input guardrails.
    const session = load(c);
    if (session instanceof Response) return session;
    const module = catalogue.modules().find((m) => m.id === c.req.param('moduleId'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    const { question } = c.req.valid('json');
    return streamSSE(c, async (stream) => {
      const emit = (event: SseEvent) => stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      const tracer = createTracer(session.id, tracerSink);
      const guarded = await runInputGuardrails(question, { mode: session.mode, tracer });
      for (const e of guarded.events) await emit({ type: 'guardrail', stage: e.stage, verdict: e.verdict, notice: e.notice });
      const pending: Promise<void>[] = [];
      const onToken = (text: string) => pending.push(emit({ type: 'token', text, agent: 'knowledge' }));
      if (guarded.action === 'wellbeing') emitWords(WELLBEING_NOTICE, onToken);
      else if (!guarded.text.trim()) emitWords('Ask me anything about this module: how it is assessed, what it covers, or what you need beforehand.', onToken);
      else {
        const facts = moduleFacts(module, rawModule(module.id), moduleTitle);
        const rec = ranked(session).find((r) => r.moduleId === module.id);
        await tracer.timed(
          { actor: 'knowledge', kind: 'agent', input: `question about ${module.code}` },
          () => answerModuleQuestion(guarded.text, facts, rec, onToken),
          (a) => ({ output: `answered (${a.length} chars)`, verdict: null }),
        );
      }
      await Promise.all(pending);
      await emit({ type: 'done', messageId: randomUUID(), widget: null });
    });
  })
  .post('/:id/cv', body(schemas.CvBody), async (c) => {
    // CV or personal statement text: redacted (G2) and injection-scanned (G3) first, then mined for interests.
    // The text itself is never stored; only evidence quotes of at most 200 characters, taken from the redacted text.
    const session = load(c);
    if (session instanceof Response) return session;
    const tracer = createTracer(session.id, tracerSink);
    const guarded = await runInputGuardrails(c.req.valid('json').text, { mode: session.mode, tracer });
    const redacted = guarded.events.some((e) => e.verdict === 'redact');
    if (guarded.action === 'wellbeing') {
      // As in the chat: nothing is extracted or stored, and a support hand-off is offered with consent (spec 11).
      const draft = draftWellbeing(session.profile);
      repo.updateSession(session.id, { escalationDraft: draft });
      tracer.record({ actor: 'supervisor', kind: 'escalation', input: 'WELLBEING', output: 'CV not processed, support offered', verdict: 'escalate' });
      return c.json({ session: fresh(session.id), slots: [], redacted: true });
    }
    // A CV shows what the student has done, which is evidence of interests and goals, not of how they like to
    // learn, so only interest and pathway updates are kept and stated preferences are never overwritten.
    const updates = (
      await tracer.timed(
        { actor: 'extractor', kind: 'agent', input: `CV (${guarded.text.length} chars after redaction)` },
        () => extract(guarded.text, ['interest', 'pathways'], catalogue.pathways().map((p) => p.id)),
        (u) => ({ output: `${u.length} slot update(s)`, verdict: null }),
      )
    ).filter((u) => u.slot.startsWith('interest:') || u.slot === 'pathways' || u.slot === 'pathwaysSkipped');
    const merged = mergeUpdates(session.profile, updates, { sessionId: session.id, turnId: randomUUID() });
    repo.addEvidence(merged.evidence);
    session.evidence.push(...merged.evidence);
    session.profile = saveProfile(session, merged.profile);
    clearExplanationCache();
    return c.json({ session: fresh(session.id), slots: [...new Set(merged.evidence.map((e) => e.slot))], redacted });
  })
  .post('/:id/feedback', body(schemas.FeedbackBody), async (c) => {
    // A thumbs up or down on one AI answer. The comment, question and answer excerpt pass G2 and G3 first,
    // so raw sensitive text is never stored; the trace gets a one-line summary only.
    const session = load(c);
    if (session instanceof Response) return session;
    const input = c.req.valid('json');
    const targetError = feedbackTargetError(session, input.target);
    if (targetError) return c.json({ error: targetError }, input.target.kind === 'message' ? 404 : 400);
    const tracer = createTracer(session.id, tracerSink);
    const deletionsBefore = deletions.get(session.id) ?? 0;
    const clean = (text: string | undefined) => cleanForStorage(text ?? '', { mode: session.mode, tracer });
    const [comment, question, answer] = await Promise.all([clean(input.comment), clean(input.question), clean(input.answerExcerpt)]);
    // The live checks take a moment; if the student deleted their data meanwhile, the vote goes with it.
    const current = repo.getSession(session.id);
    if (!current || (deletions.get(session.id) ?? 0) !== deletionsBefore || feedbackTargetError(current, input.target)) {
      return c.json({ error: 'the answer was deleted' }, 410);
    }
    const stored: Feedback = repo.addFeedback({
      id: randomUUID(),
      sessionId: session.id,
      target: input.target,
      rating: input.rating,
      reason: input.reason,
      comment: comment.text || undefined,
      question: question.text || undefined,
      answerExcerpt: answer.text || undefined,
      createdAt: new Date().toISOString(),
    });
    const redacted = [comment, question, answer].some((t) => t.changed);
    const details = [stored.reason && `reason ${stored.reason}`, stored.comment && 'with comment', redacted && 'text redacted'].filter(Boolean);
    tracer.record({
      actor: 'student',
      kind: 'agent',
      input: `feedback ${stored.rating} on ${stored.target.kind}`,
      output: ['stored', ...details].join(', '),
      verdict: redacted ? 'redact' : null,
    });
    return c.json(stored, 201);
  })
  .get('/:id/societies', (c) => {
    const session = load(c);
    return session instanceof Response ? session : c.json(matchSocieties(session.profile, catalogue.societies()));
  });
