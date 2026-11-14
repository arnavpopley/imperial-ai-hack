// Student routes (spec 13). Every body is validated with the shared zod schemas.
import { schemas, type Evidence, type ProfileEditBody, type SessionState } from '@modulematch/shared';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { QUICK_PLAN } from '../agents/interviewer.ts';
import { catalogue, clearExplanationCache, explanationFor, newSessionState, ranked, recommendationsResponse, saveProfile, setMode, timetableView, tracerSink } from '../agents/session.ts';
import { confirmProfile, handleTurn, resumeInterview } from '../agents/supervisor.ts';
import * as repo from '../db/repo.ts';
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
    ...Object.entries(edits.interests ?? {}).map(([topic, v]) => item(`interest:${topic}`, v)),
    ...Object.entries(edits.style ?? {}).flatMap(([k, v]) => (v === null || v === undefined ? [] : [item(`style.${k}`, v)])),
    ...(edits.breadthAppetite !== undefined && edits.breadthAppetite !== null ? [item('breadthAppetite', edits.breadthAppetite)] : []),
    ...(edits.pathways ? [item('pathways', edits.pathways)] : []),
    ...(edits.pathwaysSkipped !== undefined ? [item('pathwaysSkipped', edits.pathwaysSkipped)] : []),
    ...(edits.timetablePrefs?.avoidDays ? [item('timetablePrefs.avoidDays', edits.timetablePrefs.avoidDays)] : []),
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
        await stream.writeSSE({ event: 'done', data: JSON.stringify({ type: 'done', messageId: randomUUID(), widget: null }) });
      });
    });
  })
  .put('/:id/profile', body(schemas.ProfileEditBody), (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const input = c.req.valid('json');
    const { confirm, resumeInterview: resume, style, timetablePrefs, ...edits } = input;
    const evidence = editEvidence(session.id, input);
    repo.addEvidence(evidence);
    session.evidence.push(...evidence);
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
    repo.deleteProfileAndEvidence(session.id);
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
  .get('/:id/societies', (c) => {
    const session = load(c);
    return session instanceof Response ? session : c.json(matchSocieties(session.profile, catalogue.societies()));
  });
