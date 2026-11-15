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
import { answerCatalogueQuestion } from './catalogue.ts';
import { draftComplaint, draftLowConfidence, draftRuleException, draftWellbeing } from './escalation.ts';
import { extract, mergeUpdates } from './extractor.ts';
import { classifyIntent, needsClarification } from './intent.ts';
import { askNext, followUp, nextQuestion, reflect, studentTurn, unfilledSlots, whatIHeard, type Widget } from './interviewer.ts';
import { emitWords, type ChatMessage } from './llm.ts';
import { alternativesTo, holdPosition } from './matcher.ts';
import { matchModules, MAX_SUGGESTIONS } from './module-match.ts';
import { checkShortlist } from '../engines/index.ts';
import { applyShortlistEdit, catalogue, enterExplain, explanationFor, leaveExplain, moduleTitle, precomputeTopExplanations, ranked, rulesForProfile, saveProfile, setMode, syncPlanMode, timetableView, tracerSink } from './session.ts';
import { describeTimetable, explainTimetable } from './timetabler.ts';

export type Emit = (event: SseEvent) => Promise<void>;

/** Modes in which the catalogue agent answers; ESCALATED waits for staff. */
const CATALOGUE_MODES = new Set<SessionState['mode']>(['RECOMMEND', 'EXPLAIN', 'PLAN']);

const COMPLAINT =/\b(complain\w*|complaint|unfair|this advisor is (useless|wrong|bad)|report (this|a problem))\b/i;

interface Turn {
  session: SessionState;
  tracer: Tracer;
  emit: Emit;
  /** Redacted text: the only version of the student's words any agent sees. */
  text: string;
  turnId: string;
  redacted: boolean;
  /** G3 stripped an instruction from this turn. */
  injected: boolean;
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
  await emitModeChange(turn, setMode(turn.session, to, turn.tracer, reason));
}

/** Tells the client about a mode change made elsewhere (setMode, syncPlanMode); nothing when from is null. */
async function emitModeChange(turn: Turn, from: SessionState['mode'] | null) {
  if (from) await turn.emit({ type: 'mode', mode: turn.session.mode, from });
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
  const asked = {
    ...session.interview,
    questionsAsked: session.interview.questionsAsked + 1,
    askedSteps: [...session.interview.askedSteps, next.step.id],
    targetSlots: next.targetSlots,
  };
  const gaps = unfilledSlots(session.profile, session.evidence);
  const budgetLeft = session.interview.budget - session.interview.questionsAsked;
  await tracer.timed(
    { actor: 'interviewer', kind: 'agent', input: `gaps: ${gaps.join(', ') || 'none'}; budget ${budgetLeft}` },
    () =>
      reply(
        turn,
        'interviewer',
        (onToken) =>
          askNext(
            history(session),
            next,
            { gaps, budgetLeft, reflection: reflect(merged.evidence), redacted: turn.redacted, injected: turn.injected },
            onToken,
          ),
        next.step.widget,
      ),
    () => ({ output: `asked ${next.step.id}`, verdict: null }),
  );
  // Only once the question has actually been shown is it recorded as asked (a failed reply can be retried).
  session.interview = asked;
  repo.updateSession(session.id, { interview: asked });
}

/** Shortlist violations a student might ask to be excused from; missing credits are not exceptions. */
const EXCEPTION_CODES = new Set(['ECTS_CAP_EXCEEDED', 'NOT_ALLOWED', 'PREREQUISITE_MISSING']);

async function ruleExceptionTurn(turn: Turn, moduleIds: string[]) {
  const { session, tracer } = turn;
  const modules = catalogue.modules();
  const recs = ranked(session);
  const target = modules.find((m) => moduleIds.includes(m.id) && recs.find((r) => r.moduleId === m.id && !r.eligible));
  if (!target) {
    // The named modules are each allowed, but the whole proposed shortlist may still break a rule (the credit cap).
    const proposed = [...new Set([...session.shortlist, ...moduleIds])];
    const result = checkShortlist(proposed, session.profile, modules, rulesForProfile(session.profile));
    const broken = result.violations.filter((v) => EXCEPTION_CODES.has(v.code));
    tracer.record({ actor: 'matcher', kind: 'tool', input: `check_rules(${proposed.length} modules)`, output: broken.length ? `violation: ${broken.map((v) => v.code).join(', ')}` : 'no violation', verdict: broken.length ? 'block' : 'pass' });
    if (broken.length) {
      const reasons = broken.map((v) => v.message);
      await say(turn, 'matcher', `I can't approve that: ${reasons.join(' ')} The rule is set by your programme, so I can't make an exception. I have drafted a request to the Senior Tutor below, and it is only sent if you approve it.`);
      return offerDraft(turn, draftRuleException(session.profile, reasons, turn.text, modules.find((m) => moduleIds.includes(m.id))));
    }
    const named = modules.find((m) => moduleIds.includes(m.id));
    const text = named
      ? `Good news: ${named.title} is open to you under your programme rules, so no exception is needed. Add it to your shortlist from the catalogue.`
      : 'Which module or rule do you have in mind? Tell me the module code or title and I will check it.';
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
  await offerDraft(turn, draftRuleException(session.profile, reasons, turn.text, target));
}

async function explainTurn(turn: Turn, moduleIds: string[]) {
  const { session } = turn;
  const recs = ranked(session);
  const moduleId = moduleIds[0] ?? recs[0]?.moduleId;
  const rec = recs.find((r) => r.moduleId === moduleId);
  if (!moduleId) return say(turn, 'matcher', 'Which module would you like me to explain?');
  if (!rec) {
    // Completed modules are not in the catalogue, so they have no score to explain.
    const completed = session.profile.completedModuleIds.includes(moduleId);
    return say(turn, 'matcher', completed ? `You have already completed ${moduleTitle(moduleId)}, so it is not scored.` : `${moduleTitle(moduleId)} is not in your catalogue.`);
  }
  await emitModeChange(turn, enterExplain(session, turn.tracer, 'student asked why'));
  try {
    const explanation = await explanationFor(session, moduleId, turn.tracer, recs);
    const text = explanation
      ? [explanation.summary, ...explanation.because.map((b) => `• ${b.text}`), ...explanation.watchOuts.map((w) => `Watch out: ${w}`)].join('\n')
      : `${moduleTitle(moduleId)} scores ${rec.fit}.`;
    await say(turn, 'matcher', text);
  } finally {
    await emitModeChange(turn, leaveExplain(session, turn.tracer, 'explanation given'));
  }
}

/** Cross-catalogue questions ("which modules use Python?"): the catalogue agent searches with tools, read-only. */
async function catalogueTurn(turn: Turn, moduleIds: string[]) {
  const { session, tracer } = turn;
  if (!CATALOGUE_MODES.has(session.mode)) {
    return say(turn, 'supervisor', 'I can search the catalogue again once your request to staff has been answered. You can still browse it on the catalogue page.');
  }
  let outcome: Awaited<ReturnType<typeof answerCatalogueQuestion>> | null = null;
  await tracer.timed(
    { actor: 'catalogue', kind: 'agent', input: `catalogue question in ${session.mode}` },
    () =>
      reply(turn, 'catalogue', async (onToken) => {
        outcome = await answerCatalogueQuestion(turn.text, moduleIds, session, tracer, onToken);
        return outcome.text;
      }),
    () => ({ output: outcome ? `${outcome.source} answer after ${outcome.toolCalls} tool call(s)` : 'no answer', verdict: null }),
  );
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
  await emitModeChange(turn, enterExplain(session, turn.tracer, 'what-if'));
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
  await emitModeChange(turn, leaveExplain(session, turn.tracer, 'what-if applied'));
}

/** "A", "A or B", "A, B or C"; andList is the same with "and". */
const joinWith = (word: string) => (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`;
const orList = joinWith('or');
const andList = joinWith('and');

/**
 * Adds or removes the modules the student named (issue #57). matchModules settles which modules are meant,
 * asking "Did you mean …?" for a weak or tied match, and the reply names only modules whose membership
 * actually changed. Modules the live model named are only ever suggested, never acted on.
 */
async function shortlistTurn(turn: Turn, mentioned: string[]) {
  const { session } = turn;
  const action = /\b(remove|drop|take .* off|delete)\b/i.test(turn.text) ? 'remove' : 'add';
  session.shortlist = repo.listShortlist(session.id);
  const recs = ranked(session);
  const eligible = new Set(recs.filter((r) => r.eligible).map((r) => r.moduleId));
  const pool = action === 'remove' ? session.shortlist : [...eligible].filter((id) => !session.shortlist.includes(id));
  const match = matchModules(turn.text, catalogue.modules(), pool);
  const suggestions = match.suggestions.length
    ? match.suggestions
    : mentioned.filter((id) => pool.includes(id) && !match.matched.includes(id)).slice(0, MAX_SUGGESTIONS);
  const didYouMean = suggestions.length ? `Did you mean ${orList(suggestions.map(moduleTitle))}?` : '';
  if (match.matched.length === 0) {
    return say(turn, 'supervisor', didYouMean ? `${didYouMean} Nothing on your shortlist has changed.` : 'Which module should I add or remove? Use its code or title.');
  }

  const changed: string[] = [];
  const unchanged: string[] = [];
  const blocked: string[] = [];
  // Each edit goes through the same helper as the shortlist POST, so the mode and trace match the button path.
  for (const id of match.matched) {
    const before = repo.listShortlist(session.id).includes(id);
    if (action === 'add' && !before && !eligible.has(id)) {
      blocked.push(id);
      continue;
    }
    if (before === (action === 'add')) {
      unchanged.push(id);
      continue;
    }
    await emitModeChange(turn, applyShortlistEdit(session, id, action, turn.tracer));
    (session.shortlist.includes(id) === before ? unchanged : changed).push(id);
  }
  const names = (ids: readonly string[]) => andList(ids.map(moduleTitle));
  const is = (ids: readonly string[]) => (ids.length > 1 ? 'are' : 'is');
  const parts = [
    changed.length ? `${action === 'remove' ? 'Removed' : 'Added'} ${names(changed)}.` : '',
    unchanged.length ? `${names(unchanged)} ${is(unchanged)} ${action === 'remove' ? 'not' : 'already'} on your shortlist.` : '',
    blocked.length ? `${names(blocked)} ${is(blocked)} not open to you. ${RULES_NOTICE}` : '',
    unchanged.length || blocked.length ? didYouMean : '',
    changed.length === 0 ? 'Nothing on your shortlist has changed.' : '',
    changed.length && session.shortlist.length >= 2 ? 'Open the timetable to check for clashes.' : '',
  ];
  await say(turn, 'supervisor', parts.filter(Boolean).join(' '));
}

async function timetableTurn(turn: Turn) {
  const { session, tracer } = turn;
  if (session.shortlist.length < 2) return say(turn, 'timetabler', 'Shortlist at least two modules and I will check them for clashes.');
  // Normally already in PLAN from the shortlist edit; this catches a session that reached two modules earlier.
  await emitModeChange(turn, syncPlanMode(session, tracer));
  const view = timetableView(session);
  tracer.record({ actor: 'timetabler', kind: 'tool', input: `find_clashes(${session.shortlist.length} modules)`, output: `${view.clashes.length} clash(es), ${view.swaps.length} swap(s)`, verdict: null });
  const summary = describeTimetable(view.clashes, view.swaps, moduleTitle);
  await reply(turn, 'timetabler', (onToken) => explainTimetable(summary, onToken));
  if (view.clashes.some((c) => c.label === 'certain') && view.swaps.length === 0) {
    await offerDraft(turn, draftLowConfidence(session.profile, 'the shortlist has a certain clash and no valid swap.'));
  }
  // The session stays in PLAN: it rests there while the shortlist has two or more modules (spec 12).
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

/** After the "Here is what I heard" card, a chat message is a correction: apply it and show the card again. */
async function correctSummaryTurn(turn: Turn) {
  const { session } = turn;
  const updates = await extract(turn.text, [], catalogue.pathways().map((p) => p.id));
  const merged = mergeUpdates(session.profile, updates, { sessionId: session.id, turnId: turn.turnId });
  repo.addEvidence(merged.evidence);
  session.evidence.push(...merged.evidence);
  session.profile = saveProfile(session, merged.profile);
  await turn.emit({ type: 'profile_update', profile: session.profile, evidence: session.evidence });
  const titles = Object.fromEntries(catalogue.pathways().map((p) => [p.id, p.title]));
  const lead = merged.evidence.length ? 'Updated.' : 'I could not tell what to change, so here is the summary again. You can also edit it directly.';
  await say(turn, 'interviewer', `${lead}\n${whatIHeard(session.profile, titles)}`, { kind: 'confirm-profile', fields: [] });
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

/** One turn at a time per session, so concurrent tabs cannot overwrite each other's profile changes. */
const sessionQueues = new Map<string, Promise<void>>();

export function handleTurn(sessionId: string, body: SendMessageBody, emit: Emit): Promise<void> {
  const previous = sessionQueues.get(sessionId) ?? Promise.resolve();
  const run = previous.then(() => runTurn(sessionId, body, emit));
  const settled = run.catch(() => {});
  sessionQueues.set(sessionId, settled);
  void settled.then(() => {
    if (sessionQueues.get(sessionId) === settled) sessionQueues.delete(sessionId);
  });
  return run;
}

async function runTurn(sessionId: string, body: SendMessageBody, emit: Emit): Promise<void> {
  // Loaded inside the queue, so each turn starts from the state the previous turn saved.
  const session = repo.getSession(sessionId);
  if (!session) throw new Error(`unknown session ${sessionId}`);
  const tracer = createTracer(sessionId, tracerSink);
  const guarded = await runInputGuardrails(body.content, { mode: session.mode, tracer });
  for (const e of guarded.events) await emit({ type: 'guardrail', stage: e.stage, verdict: e.verdict, notice: e.notice });

  const turnId = randomUUID();
  // A message that triggered the wellbeing check is never stored: it may disclose health details (spec 20.2).
  const stored =
    guarded.action === 'wellbeing'
      ? '[Not stored: support contacts were shown]'
      : guarded.text || (body.structured ? 'Slider answer' : '[removed]');
  repo.addMessage({ ...message(session.id, 'student', stored, null), id: turnId });
  session.messages.push({ ...message(session.id, 'student', stored, null), id: turnId });
  const changedBy = (stage: string) => guarded.events.some((e) => e.stage === stage && e.verdict === 'redact');
  const turn: Turn = { session, tracer, emit, text: guarded.text, turnId, redacted: changedBy('G2 redaction'), injected: changedBy('G3 injection') };

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
  if (session.mode === 'INTERVIEW') return correctSummaryTurn(turn);
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
    case 'catalogue_question':
      return catalogueTurn(turn, intent.moduleIds);
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

/** Questions a resumed interview may ask (spec 8.6: medium confidence "offers two more questions"). */
export const RESUME_BUDGET = 2;

/**
 * Student agrees to answer two more questions (spec 8.6 and 12: "low confidence and student agrees"). From PLAN or
 * ESCALATED the session first returns to RECOMMEND, since only RECOMMEND may enter the interview. The interviewer asks
 * the first of the two highest-priority unfilled slots straight away, and the second after the student answers; then
 * the "Here is what I heard" card returns, and confirming it goes back to RECOMMEND with a re-ranked catalogue.
 */
export function resumeInterview(session: SessionState): void {
  const tracer = createTracer(session.id, tracerSink);
  if (session.mode === 'PLAN' || session.mode === 'ESCALATED') setMode(session, 'RECOMMEND', tracer, 'returning to the interview for two more questions');
  if (!setMode(session, 'INTERVIEW', tracer, 'low confidence and student agrees') && session.mode !== 'INTERVIEW') return;
  session.interview = { ...session.interview, finished: false, confirmed: false, budget: session.interview.questionsAsked + RESUME_BUDGET };
  const found = nextQuestion(session, session.interview.askedSteps);
  // The question goes in as a stored message, which cannot carry a widget, so a slider step is asked as its text follow-up.
  const gaps = unfilledSlots(session.profile, session.evidence);
  const next = found?.step.widget ? followUp(found.targetSlots.find((slot) => gaps.includes(slot)) ?? found.targetSlots[0]!) : found;
  if (!next) {
    // Nothing left to ask: close the interview again so the card shows.
    session.interview = { ...session.interview, finished: true, targetSlots: [] };
    repo.updateSession(session.id, { interview: session.interview });
    return;
  }
  tracer.record({ actor: 'interviewer', kind: 'agent', input: `gaps: ${gaps.join(', ') || 'none'}; budget ${RESUME_BUDGET}`, output: `asked ${next.step.id}`, verdict: null });
  repo.addMessage(message(session.id, 'assistant', next.step.question, 'interviewer'));
  session.interview = {
    ...session.interview,
    questionsAsked: session.interview.questionsAsked + 1,
    askedSteps: [...session.interview.askedSteps, next.step.id],
    targetSlots: next.targetSlots,
  };
  repo.updateSession(session.id, { interview: session.interview });
}
