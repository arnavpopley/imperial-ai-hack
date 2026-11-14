// Supervisor (spec 10.1): owns the mode, routes each student turn to one agent, and raises escalations.
// It is a deterministic state machine plus one intent classification. Every step is traced.
import { confidenceLabel, type Message, type SendMessageBody, type SessionState, type SseEvent, type Weights } from '@modulematch/shared';
import { randomUUID } from 'node:crypto';
import * as repo from '../db/repo.ts';
import { SCOPE_REDIRECT } from '../guardrails/g1-scope.ts';
import { WELLBEING_NOTICE } from '../guardrails/g4-wellbeing.ts';
import { RULES_NOTICE, keepEligible } from '../guardrails/g7-rules.ts';
import { runInputGuardrails } from '../guardrails/pipeline.ts';
import { createTracer, type Tracer } from '../trace/tracer.ts';
import { draftComplaint, draftLowConfidence, draftRuleException, draftWellbeing } from './escalation.ts';
import { extract, mergeUpdates } from './extractor.ts';
import { classifyIntent, needsClarification } from './intent.ts';
import { askNext, nextQuestion, reflect, studentTurn, unfilledSlots, whatIHeard, type Widget } from './interviewer.ts';
import { emitWords, type ChatMessage } from './llm.ts';
import { alternativesTo, holdPosition } from './matcher.ts';
import { RESTING_MODE } from './modes.ts';
import { catalogue, explanationFor, moduleTitle, precomputeTopExplanations, ranked, saveProfile, setMode, timetableView, tracerSink } from './session.ts';
import { describeTimetable, explainTimetable } from './timetabler.ts';

export type Emit = (event: SseEvent) => Promise<void>;

const COMPLAINT = /\b(complain\w*|complaint|unfair|this advisor is (useless|wrong|bad)|report (this|a problem))\b/i;

interface Turn {
  session: SessionState;
  tracer: Tracer;
  emit: Emit;
  /** Redacted text: the only version of the student's words any agent sees. */
  text: string;
  turnId: string;
  redacted: boolean;
}

function message(sessionId: string, role: Message['role'], content: string, agent: string | null): Message {
  return { id: randomUUID(), sessionId, role, agent, content, at: new Date().toISOString() };
}

/** Streams an assistant reply, stores it, and closes the turn with an optional UI widget. */
async function reply(turn: Turn, agent: string, write: (onToken: (t: string) => void) => Promise<string>, widget: Widget = null) {
  const pending: Promise<void>[] = [];
  const text = await write((t) => pending.push(turn.emit({ type: 'token', text: t, agent })));
  await Promise.all(pending);
  const msg = message(turn.session.id, 'assistant', text, agent);
  repo.addMessage(msg);
  await turn.emit({ type: 'done', messageId: msg.id, widget });
}

const say = (turn: Turn, agent: string, text: string, widget: Widget = null) =>
  reply(turn, agent, async (onToken) => {
    emitWords(text, onToken);
    return text;
  }, widget);

async function changeMode(turn: Turn, to: SessionState['mode'], reason: string) {
  const from = setMode(turn.session, to, turn.tracer, reason);
  if (from) await turn.emit({ type: 'mode', mode: to, from });
}

async function offerDraft(turn: Turn, draft: NonNullable<SessionState['escalationDraft']>) {
  turn.session.escalationDraft = draft;
  repo.updateSession(turn.session.id, { escalationDraft: draft });
  turn.tracer.record({ actor: 'supervisor', kind: 'escalation', input: draft.type, output: 'draft offered, awaiting student approval', verdict: 'escalate' });
  await turn.emit({ type: 'escalation', draft, escalation: null });
}

/** The interviewer's history: previous turns as plain chat messages, student turns wrapped as data. */
function history(session: SessionState): ChatMessage[] {
  return session.messages.slice(-12).map((m) =>
    m.role === 'student' ? studentTurn(m.content) : { role: 'assistant' as const, content: m.content },
  );
}

// ---------- agent routes ----------

async function interviewTurn(turn: Turn, structuredAnswers: SendMessageBody['structured']) {
  const { session, tracer } = turn;
  const pathwayIds = catalogue.pathways().map((p) => p.id);
  const updates = await tracer.timed(
    { actor: 'extractor', kind: 'agent', input: `turn targeting ${session.interview.targetSlots.join(', ') || 'anything'}` },
    () => extract(turn.text, session.interview.targetSlots, pathwayIds, structuredAnswers),
    (u) => ({ output: `${u.length} slot update(s): ${[...new Set(u.map((x) => x.slot))].join(', ') || 'none'}`, verdict: null }),
  );
  const merged = mergeUpdates(session.profile, updates, { sessionId: session.id, turnId: turn.turnId });
  repo.addEvidence(merged.evidence);
  session.evidence = [...session.evidence, ...merged.evidence];
  session.profile = saveProfile(session, merged.profile);
  await turn.emit({ type: 'profile_update', profile: session.profile, evidence: session.evidence });

  const next = nextQuestion(session, session.interview.askedSteps);
  if (!next) {
    session.interview = { ...session.interview, finished: true, targetSlots: [] };
    repo.updateSession(session.id, { interview: session.interview });
    tracer.record({ actor: 'interviewer', kind: 'agent', input: `${session.interview.questionsAsked} questions asked`, output: 'finish_interview', verdict: null });
    const titles = Object.fromEntries(catalogue.pathways().map((p) => [p.id, p.title]));
    await say(turn, 'interviewer', whatIHeard(session.profile, titles), { kind: 'confirm-profile', fields: [] });
    return;
  }
  session.interview = {
    ...session.interview,
    questionsAsked: session.interview.questionsAsked + 1,
    askedSteps: [...session.interview.askedSteps, next.step.id],
    targetSlots: next.targetSlots,
  };
  repo.updateSession(session.id, { interview: session.interview });
  const gaps = unfilledSlots(session.profile, session.evidence);
  await tracer.timed(
    { actor: 'interviewer', kind: 'agent', input: `gaps: ${gaps.join(', ') || 'none'}; budget ${session.interview.budget - session.interview.questionsAsked + 1}` },
    () =>
      reply(
        turn,
        'interviewer',
        (onToken) =>
          askNext(
            history(session),
            next,
            { gaps, budgetLeft: session.interview.budget - session.interview.questionsAsked + 1, reflection: reflect(merged.evidence), redacted: turn.redacted },
            onToken,
          ),
        next.step.widget,
      ),
    () => ({ output: `asked ${next.step.id}`, verdict: null }),
  );
}

async function ruleExceptionTurn(turn: Turn, moduleIds: string[]) {
  const { session, tracer } = turn;
  const modules = catalogue.modules();
  const recs = ranked(session);
  const target = modules.find((m) => moduleIds.includes(m.id) && recs.find((r) => r.moduleId === m.id && !r.eligible));
  if (!target) {
    const named = modules.find((m) => moduleIds.includes(m.id));
    const text = named
      ? `Good news: ${named.title} is open to you under your programme rules, so no exception is needed. Add it to your shortlist from the catalogue.`
      : 'Which module do you have in mind? Tell me its code or title and I will check the rules.';
    await say(turn, 'matcher', text);
    return;
  }
  const reasons = recs.find((r) => r.moduleId === target.id)!.ineligibleReasons;
  const alternatives = alternativesTo(target, modules, recs, session.shortlist);
  const guarded = keepEligible(alternatives.map((a) => a.moduleId), recs);
  tracer.record({ actor: 'G7 rules', kind: 'guardrail', input: `alternatives to ${target.code}`, output: guarded.removed.length ? `${guarded.removed.length} ineligible removed` : 'all eligible', verdict: guarded.removed.length ? 'redact' : 'pass' });
  tracer.record({ actor: 'matcher', kind: 'tool', input: `check_rules([${target.code}])`, output: `violation: ${reasons.join(' ')}`, verdict: 'block' });
  await tracer.timed(
    { actor: 'matcher', kind: 'agent', input: `rule exception request for ${target.code}` },
    () =>
      reply(turn, 'matcher', (onToken) =>
        holdPosition(
          { module: target, reasons, alternatives: guarded.kept.map((id) => ({ title: moduleTitle(id), fit: recs.find((r) => r.moduleId === id)!.fit })) },
          onToken,
        ),
      ),
    () => ({ output: 'held position, offered alternatives and escalation', verdict: 'block' }),
  );
  await offerDraft(turn, draftRuleException(session.profile, target, reasons, turn.text));
}

async function explainTurn(turn: Turn, moduleIds: string[]) {
  const { session } = turn;
  const recs = ranked(session);
  const moduleId = moduleIds[0] ?? recs[0]?.moduleId;
  if (!moduleId) return say(turn, 'matcher', 'Which module would you like me to explain?');
  await changeMode(turn, 'EXPLAIN', 'student asked why');
  const explanation = await explanationFor(session, moduleId, turn.tracer, recs);
  const rec = recs.find((r) => r.moduleId === moduleId)!;
  const text = explanation
    ? [explanation.summary, ...explanation.because.map((b) => `• ${b.text}`), ...explanation.watchOuts.map((w) => `Watch out: ${w}`)].join('\n')
    : `${moduleTitle(moduleId)} scores ${rec.fit}.`;
  await say(turn, 'matcher', text);
  await changeMode(turn, RESTING_MODE, 'explanation given');
}

/** "What if I cared more about X": shifts one weight, re-ranks, and reports what moved (spec 10.5). */
const WEIGHT_CUES: [keyof Weights, RegExp][] = [
  ['goal', /\b(career|job|pathway|goal|after graduat\w*)\b/i],
  ['style', /\b(style|exams?|coursework|team|workload|learning)\b/i],
  ['breadth', /\b(breadth|outside|different|other facult\w*|variety)\b/i],
  ['interest', /\b(interest\w*|enjoy|topic|content|passion)\b/i],
];

async function whatIfTurn(turn: Turn) {
  const { session } = turn;
  const dimension = WEIGHT_CUES.find(([, re]) => re.test(turn.text))?.[0];
  if (!dimension) return say(turn, 'matcher', 'Tell me what you would like to care more or less about: interests, career, learning style or breadth. You can also move the sliders on the catalogue.');
  await changeMode(turn, 'EXPLAIN', 'what-if');
  const less = /\b(less|lower|not care|ignore)\b/i.test(turn.text);
  const before = ranked(session).slice(0, 3);
  const weights: Weights = { ...session.weights, [dimension]: Math.max(0, session.weights[dimension] + (less ? -0.15 : 0.15)) };
  session.weights = weights;
  repo.updateSession(session.id, { weights });
  turn.tracer.record({ actor: 'matcher', kind: 'tool', input: `score_modules(${dimension} ${less ? '-' : '+'}0.15)`, output: 'catalogue re-ranked', verdict: null });
  const after = ranked(session).slice(0, 3);
  const line = (r: { moduleId: string; fit: number }) => `${moduleTitle(r.moduleId)} (${r.fit})`;
  await say(
    turn,
    'matcher',
    `I gave ${dimension === 'goal' ? 'career' : dimension} ${less ? 'less' : 'more'} weight. Top three before: ${before.map(line).join(', ')}. Now: ${after.map(line).join(', ')}. The sliders on the catalogue show the new weights, and you can reset them any time.`,
  );
  await turn.emit({ type: 'recommendations_ready', count: after.length });
  await changeMode(turn, RESTING_MODE, 'what-if applied');
}

async function shortlistTurn(turn: Turn, moduleIds: string[]) {
  const { session } = turn;
  const remove = /\b(remove|drop|take .* off|delete)\b/i.test(turn.text);
  if (moduleIds.length === 0) return say(turn, 'supervisor', 'Which module should I add or remove? Use its code or title.');
  const recs = ranked(session);
  const added: string[] = [];
  const blocked: string[] = [];
  for (const id of moduleIds) {
    if (remove) repo.removeFromShortlist(session.id, id);
    else if (recs.find((r) => r.moduleId === id)?.eligible) {
      repo.addToShortlist(session.id, id);
      added.push(id);
    } else blocked.push(id);
  }
  session.shortlist = repo.listShortlist(session.id);
  const parts = [
    remove ? `Removed ${moduleIds.map(moduleTitle).join(', ')}.` : added.length ? `Added ${added.map(moduleTitle).join(', ')}.` : '',
    blocked.length ? `${blocked.map(moduleTitle).join(', ')} is not open to you. ${RULES_NOTICE}` : '',
    session.shortlist.length >= 2 ? 'Open the timetable to check for clashes.' : '',
  ];
  await say(turn, 'supervisor', parts.filter(Boolean).join(' '));
}

async function timetableTurn(turn: Turn) {
  const { session, tracer } = turn;
  if (session.shortlist.length < 2) return say(turn, 'timetabler', 'Shortlist at least two modules and I will check them for clashes.');
  await changeMode(turn, 'PLAN', 'timetable requested');
  const view = timetableView(session);
  tracer.record({ actor: 'timetabler', kind: 'tool', input: `find_clashes(${session.shortlist.length} modules)`, output: `${view.clashes.length} clash(es), ${view.swaps.length} swap(s)`, verdict: null });
  const summary = describeTimetable(view.clashes, view.swaps, moduleTitle);
  await reply(turn, 'timetabler', (onToken) => explainTimetable(summary, onToken));
  if (view.clashes.some((c) => c.label === 'certain') && view.swaps.length === 0) {
    await offerDraft(turn, draftLowConfidence(session.profile, 'the shortlist has a certain clash and no valid swap.'));
    return;
  }
  await changeMode(turn, RESTING_MODE, 'timetable explained');
}

async function pathwayTurn(turn: Turn) {
  const pathwayIds = catalogue.pathways().map((p) => p.id);
  const updates = await extract(turn.text, ['pathways'], pathwayIds);
  const chosen = updates.find((u) => u.slot === 'pathways');
  if (!chosen) return say(turn, 'supervisor', 'You can pick up to three career pathways on the Pathways page. Each one shows your progress and the next best module.');
  const merged = mergeUpdates(turn.session.profile, [chosen], { sessionId: turn.session.id, turnId: turn.turnId });
  repo.addEvidence(merged.evidence);
  turn.session.evidence.push(...merged.evidence);
  turn.session.profile = saveProfile(turn.session, merged.profile);
  await turn.emit({ type: 'profile_update', profile: turn.session.profile, evidence: turn.session.evidence });
  await say(turn, 'supervisor', `Pathways set: ${turn.session.profile.pathways.join(', ')}. The Pathways page shows your progress.`);
}

async function editProfileTurn(turn: Turn) {
  const { session } = turn;
  const updates = await extract(turn.text, [], catalogue.pathways().map((p) => p.id));
  const merged = mergeUpdates(session.profile, updates, { sessionId: session.id, turnId: turn.turnId });
  repo.addEvidence(merged.evidence);
  session.evidence.push(...merged.evidence);
  session.profile = saveProfile(session, merged.profile);
  session.interview = { ...session.interview, disputes: session.interview.disputes + 1 };
  repo.updateSession(session.id, { interview: session.interview });
  await turn.emit({ type: 'profile_update', profile: session.profile, evidence: session.evidence });
  await say(turn, 'supervisor', merged.evidence.length ? 'Updated your profile, and the ranking has been recalculated.' : 'I could not tell what to change. You can also edit your profile directly in "Your data".');
  if (session.interview.disputes >= 2 && !session.escalationDraft) {
    await offerDraft(turn, draftLowConfidence(session.profile, 'the student has corrected their profile more than once.'));
  }
}

// ---------- entry point ----------

export async function handleTurn(sessionId: string, body: SendMessageBody, emit: Emit): Promise<void> {
  const session = repo.getSession(sessionId);
  if (!session) throw new Error(`unknown session ${sessionId}`);
  const tracer = createTracer(sessionId, tracerSink);
  const guarded = await runInputGuardrails(body.content, { mode: session.mode, tracer });
  for (const e of guarded.events) await emit({ type: 'guardrail', stage: e.stage, verdict: e.verdict, notice: e.notice });

  const turnId = randomUUID();
  const stored = guarded.text || (body.structured ? 'Slider answer' : '[removed]');
  repo.addMessage({ ...message(session.id, 'student', stored, null), id: turnId });
  session.messages.push({ ...message(session.id, 'student', stored, null), id: turnId });
  const turn: Turn = { session, tracer, emit, text: guarded.text, turnId, redacted: guarded.events.some((e) => e.stage === 'G2 redaction' && e.verdict === 'redact') };

  if (guarded.action === 'wellbeing') {
    await say(turn, 'supervisor', WELLBEING_NOTICE);
    return offerDraft(turn, draftWellbeing(session.profile));
  }
  if (guarded.action === 'redirect') return say(turn, 'supervisor', SCOPE_REDIRECT);
  if (session.mode === 'ONBOARD') await changeMode(turn, 'INTERVIEW', 'programme and year entered');

  const intent = await tracer.timed(
    { actor: 'supervisor', kind: 'agent', input: `classify intent in ${session.mode}` },
    () => classifyIntent(turn.text, session.mode, catalogue.modules()),
    (r) => ({ output: `${r.intent} (${r.confidence.toFixed(2)})`, verdict: null }),
  );
  if (COMPLAINT.test(turn.text)) {
    await say(turn, 'supervisor', 'I am sorry this has not been helpful. I have drafted a note to the admin team; edit it if you like and approve it to send.');
    return offerDraft(turn, draftComplaint(session.profile, turn.text));
  }
  if (intent.intent === 'wellbeing') {
    await say(turn, 'supervisor', WELLBEING_NOTICE);
    return offerDraft(turn, draftWellbeing(session.profile));
  }
  if (intent.intent === 'rule_exception_request') return ruleExceptionTurn(turn, intent.moduleIds);
  if (session.mode === 'INTERVIEW' && !session.interview.finished) return interviewTurn(turn, body.structured);
  if (session.mode === 'INTERVIEW') {
    return say(turn, 'interviewer', 'Confirm the summary above to see your ranked modules, or tell me what to change.', { kind: 'confirm-profile', fields: [] });
  }
  if (needsClarification(intent)) {
    return say(turn, 'supervisor', 'Do you want me to explain a module, change what matters most to you, edit your shortlist, or check your timetable?');
  }
  switch (intent.intent) {
    case 'ask_why':
      return explainTurn(turn, intent.moduleIds);
    case 'what_if':
      return whatIfTurn(turn);
    case 'shortlist_action':
      return shortlistTurn(turn, intent.moduleIds);
    case 'timetable_action':
      return timetableTurn(turn);
    case 'pathway_action':
      return pathwayTurn(turn);
    case 'edit_profile':
    case 'answer_interview':
      return editProfileTurn(turn);
    case 'smalltalk':
      return say(turn, 'supervisor', 'Happy to help. Ask me why a module scored as it did, or what changes if you care more about your career.');
    default:
      return say(turn, 'supervisor', SCOPE_REDIRECT);
  }
}

/** Student confirms the "Here is what I heard" card or skips the interview (spec 12: INTERVIEW -> RECOMMEND). */
export function confirmProfile(session: SessionState): { tracer: Tracer; lowConfidence: boolean } {
  const tracer = createTracer(session.id, tracerSink);
  if (session.mode === 'ONBOARD') setMode(session, 'INTERVIEW', tracer, 'programme and year entered');
  session.interview = { ...session.interview, finished: true, confirmed: true, targetSlots: [] };
  repo.updateSession(session.id, { interview: session.interview });
  setMode(session, 'RECOMMEND', tracer, 'profile confirmed or interview skipped');
  const lowConfidence = confidenceLabel(session.profile.completeness) === 'low';
  if (lowConfidence) {
    // Spec 8.6: low confidence greys the scores and the Supervisor proposes returning to the interview.
    repo.addMessage(
      message(session.id, 'assistant', 'I do not know enough about you yet, so these scores are rough. Answer a few more questions for better matches, or ask for a personal tutor to help.', 'supervisor'),
    );
    const draft = draftLowConfidence(session.profile, 'the profile is less than half complete after the interview.');
    session.escalationDraft = draft;
    repo.updateSession(session.id, { escalationDraft: draft });
    tracer.record({ actor: 'supervisor', kind: 'escalation', input: 'LOW_CONFIDENCE', output: 'draft offered, awaiting student approval', verdict: 'escalate' });
  }
  precomputeTopExplanations(session, tracer);
  return { tracer, lowConfidence };
}

/** Student agrees to return to the interview from RECOMMEND (spec 12). */
export function resumeInterview(session: SessionState): void {
  const tracer = createTracer(session.id, tracerSink);
  session.interview = { ...session.interview, finished: false, confirmed: false, budget: session.interview.questionsAsked + 2 };
  repo.updateSession(session.id, { interview: session.interview });
  setMode(session, 'INTERVIEW', tracer, 'low confidence and student agrees');
}
