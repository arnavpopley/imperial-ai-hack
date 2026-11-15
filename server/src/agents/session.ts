// Session services shared by the Supervisor and the HTTP routes: derived views (recommendations, timetable,
// explanations) and audited mode changes. Numbers always come from the engines (spec 4 design rule).
import {
  confidenceLabel,
  DEFAULT_WEIGHTS,
  INTERVIEW_BUDGET,
  type CreateSessionBody,
  type Explanation,
  type Mode,
  type PerformanceView,
  type ProgrammeRules,
  type Recommendation,
  type RecommendationsResponse,
  type SessionState,
  type StudentProfile,
  type TimetableView,
} from '@modulematch/shared';
import { randomUUID } from 'node:crypto';
import { loadModuleResources, loadPathways, loadSocieties, rulesFor } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';
import { checkShortlist, completeness, coreInPlan, performanceView, planTimetable, profileHash, rankModules } from '../engines/index.ts';
import type { Tracer } from '../trace/tracer.ts';
import { explain } from './matcher.ts';
import { canTransition, restingModeFor } from './modes.ts';

export const catalogue = {
  /** Modules with their staff-provided resources (past papers, reading) merged in from data/module-resources.json. */
  modules: () => {
    const resources = loadModuleResources();
    return repo.listModules().map((m) => ({ ...m, resources: resources[m.id] ?? m.resources }));
  },
  slots: () => repo.listSlots(),
  pathways: () => loadPathways(),
  societies: () => loadSocieties(),
};

/**
 * Programme rules for the student. Unknown programmes get permissive rules (every catalogue module allowed,
 * no home-topic overlap) so the catalogue still works; the seeded demo programme has real rules.
 */
export function rulesForProfile(profile: StudentProfile): ProgrammeRules {
  const rules = rulesFor(profile.programme, profile.yearOfStudy);
  if (rules) return rules;
  const modules = catalogue.modules();
  return {
    programme: profile.programme,
    year: profile.yearOfStudy,
    coreModuleIds: [],
    allowedElectiveIds: modules.map((m) => m.id),
    electiveEctsRequired: 0,
    maxEcts: 75,
    iExploreRequired: false,
    homeTopics: {},
  };
}

export function emptyProfile(body: CreateSessionBody, studentId: string): StudentProfile {
  return {
    studentId,
    programme: body.programme,
    yearOfStudy: body.yearOfStudy,
    completedModuleIds: body.completedModuleIds,
    interests: {},
    pathways: [],
    pathwaysSkipped: false,
    style: { examPreference: null, groupPreference: null, appliedPreference: null, mathsComfort: null, codingComfort: null, workloadTolerance: null },
    breadthAppetite: null,
    timetablePrefs: { avoidDays: [], earliestStart: null },
    completeness: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * When a student skips the completed-modules question, assume they passed the core modules of earlier years,
 * which is what progression requires. They can correct it in "Your data".
 */
export function defaultCompleted(body: CreateSessionBody): string[] {
  if (body.completedModuleIds.length > 0) return body.completedModuleIds;
  return catalogue.modules().filter((m) => m.type === 'core' && m.level < body.yearOfStudy).map((m) => m.id);
}

export function newSessionState(input: CreateSessionBody): SessionState {
  const body = { ...input, completedModuleIds: defaultCompleted(input) };
  const now = new Date().toISOString();
  const id = randomUUID();
  return {
    id,
    mode: 'ONBOARD',
    profile: emptyProfile(body, `student-${id.slice(0, 8)}`),
    evidence: [],
    messages: [],
    weights: DEFAULT_WEIGHTS,
    shortlist: [],
    interview: {
      depth: body.interviewDepth,
      questionsAsked: 0,
      budget: INTERVIEW_BUDGET[body.interviewDepth],
      finished: false,
      confirmed: false,
      askedSteps: [],
      targetSlots: [],
      disputes: 0,
    },
    escalations: [],
    escalationDraft: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Recomputes completeness from the evidence (spec 8.6) and stores the profile. */
export function saveProfile(session: SessionState, profile: StudentProfile): StudentProfile {
  const next = { ...profile, completeness: completeness(profile, session.evidence) };
  repo.saveProfile(session.id, next);
  return next;
}

/**
 * The catalogue as the student sees it: completed modules are left out, and eligible modules are listed
 * before ineligible ones, which stay visible with their reasons (spec 8.7). Order within each group is the
 * engine's ranking.
 */
export function ranked(session: SessionState): Recommendation[] {
  const completed = new Set(session.profile.completedModuleIds);
  const all = rankModules(session.profile, catalogue.modules(), session.weights, rulesForProfile(session.profile)).filter(
    (r) => !completed.has(r.moduleId),
  );
  return [...all.filter((r) => r.eligible), ...all.filter((r) => !r.eligible)];
}

export function recommendationsResponse(session: SessionState): RecommendationsResponse {
  return {
    weights: session.weights,
    confidence: confidenceLabel(session.profile.completeness),
    completeness: session.profile.completeness,
    recommendations: ranked(session),
    coreModuleIds: coreInPlan(rulesForProfile(session.profile), session.profile),
  };
}

export function timetableView(session: SessionState, recs = ranked(session)): TimetableView {
  const slots = catalogue.slots();
  const modules = catalogue.modules();
  const rules = rulesForProfile(session.profile);
  const check = (shortlist: readonly string[]) => checkShortlist(shortlist, session.profile, modules, rules);
  return {
    // Core modules, clashes against them, swaps and kept-free time all come from the timetable engine (spec 9.2).
    ...planTimetable(session.profile, session.shortlist, recs, slots, { modules, rules, check }),
    rules: check(session.shortlist),
  };
}

/** Moves the session to a new mode when spec 12 allows it, and traces the transition. Returns the old mode. */
export function setMode(session: SessionState, to: Mode, tracer: Tracer, reason: string): Mode | null {
  const from = session.mode;
  if (from === to) return null;
  if (!canTransition(from, to)) {
    tracer.record({ actor: 'supervisor', kind: 'mode', input: `${from} -> ${to}`, output: `refused: ${reason}`, verdict: 'block' });
    return null;
  }
  session.mode = to;
  repo.updateSession(session.id, { mode: to });
  tracer.record({ actor: 'supervisor', kind: 'mode', input: from, output: `${to}: ${reason}`, verdict: null });
  return from;
}

/**
 * Spec 12: RECOMMEND moves to PLAN once the shortlist has two or more modules, and PLAN returns to
 * RECOMMEND when it drops below two. Editing a shortlist that stays at two or more, as a swap does (the
 * client adds the alternative before removing the module it replaces), keeps the session in PLAN, so the
 * trace records each change of mode once instead of PLAN -> RECOMMEND -> PLAN on every edit.
 */
export function syncPlanMode(session: SessionState, tracer: Tracer): Mode | null {
  if (session.mode !== 'RECOMMEND' && session.mode !== 'PLAN') return null;
  const to = restingModeFor(session.shortlist);
  return setMode(session, to, tracer, to === 'PLAN' ? 'shortlist has two or more modules' : 'shortlist edited');
}

/**
 * A chat turn's copy of the session can be stale: it awaits guardrails and intent first, and the student may
 * edit the shortlist or send an escalation in another tab meanwhile. Read the saved mode and shortlist back
 * just before a transition; the read and the mode write then run synchronously, so nothing slips in between.
 */
function reloadModeAndShortlist(session: SessionState): void {
  const saved = repo.getSession(session.id);
  if (!saved) return;
  session.mode = saved.mode;
  session.shortlist = saved.shortlist;
}

/** Spec 12: RECOMMEND or PLAN -> EXPLAIN when the student asks why or what-if. Returns the mode it left. */
export function enterExplain(session: SessionState, tracer: Tracer, reason: string): Mode | null {
  reloadModeAndShortlist(session);
  return setMode(session, 'EXPLAIN', tracer, reason);
}

/**
 * Spec 12: EXPLAIN returns to the mode the shortlist implies (restingModeFor), PLAN at two or more modules.
 * A session that left EXPLAIN meanwhile, for example to ESCALATED, is left where it is.
 */
export function leaveExplain(session: SessionState, tracer: Tracer, reason: string): Mode | null {
  reloadModeAndShortlist(session);
  return session.mode === 'EXPLAIN' ? setMode(session, restingModeFor(session.shortlist), tracer, reason) : null;
}

/**
 * One shortlist edit, shared by the shortlist POST and the chat's shortlist turn so both leave the same
 * trace: saves it, records it, and applies the spec 12 shortlist-size transitions. Eligibility is the
 * caller's gate. Returns the mode the session left, or null when the mode did not change.
 *
 * The saved mode is read back first (reloadModeAndShortlist), so a stale chat copy cannot overwrite it.
 */
export function applyShortlistEdit(session: SessionState, moduleId: string, action: 'add' | 'remove', tracer: Tracer): Mode | null {
  reloadModeAndShortlist(session);
  if (action === 'add') repo.addToShortlist(session.id, moduleId);
  else repo.removeFromShortlist(session.id, moduleId);
  session.shortlist = repo.listShortlist(session.id);
  tracer.record({ actor: 'supervisor', kind: 'tool', input: `shortlist ${action} ${moduleId}`, output: `${session.shortlist.length} on shortlist`, verdict: null });
  return syncPlanMode(session, tracer);
}

/**
 * Topic strengths and nudges from the student's consented results (spec 23). Informational only: nothing here feeds
 * the scoring engine, so fit scores and rankings are the same with or without results.
 */
export function performanceFor(session: SessionState): PerformanceView {
  return performanceView(repo.getResults(session.id), catalogue.modules(), {
    interests: session.profile.interests,
    exclude: session.profile.completedModuleIds,
  });
}

/** Explanations are cached by profile hash and module ID (spec 5 cost control). */
const explanationCache = new Map<string, Explanation>();

export function clearExplanationCache(): void {
  explanationCache.clear();
}

/**
 * The explanation for one module. It never carries a performance nudge (spec 23): nudges come only from
 * GET /performance and appear once, as the "Keep in mind" note on the module page and the catalogue cards, so
 * nothing derived from marks is stored with chat replies or outlives a withdrawal of consent.
 */
export async function explanationFor(
  session: SessionState,
  moduleId: string,
  tracer: Tracer,
  recs = ranked(session),
): Promise<Explanation | null> {
  const module = catalogue.modules().find((m) => m.id === moduleId);
  const rec = recs.find((r) => r.moduleId === moduleId);
  if (!module || !rec) return null;
  const key = `${profileHash(session.profile, session.weights)}:${moduleId}`;
  const cached = explanationCache.get(key);
  if (cached) return cached;
  const explanation = await tracer.timed(
    { actor: 'matcher', kind: 'agent', input: `explain ${module.code} (fit ${rec.fit})` },
    () => explain(session.profile, module, rec, session.evidence, tracer),
    (e) => ({ output: `${e.because.length} reasons, ${e.watchOuts.length} watch-outs`, verdict: null }),
  );
  explanationCache.set(key, explanation);
  return explanation;
}

/** Spec 10.5: explanations for the top ten are precomputed when RECOMMEND starts, without blocking. */
export function precomputeTopExplanations(session: SessionState, tracer: Tracer): void {
  const recs = ranked(session);
  void Promise.allSettled(recs.slice(0, 10).map((r) => explanationFor(session, r.moduleId, tracer, recs)));
}

export const moduleTitle = (moduleId: string) => catalogue.modules().find((m) => m.id === moduleId)?.title ?? moduleId;

export const tracerSink = (event: Parameters<typeof repo.addTraceEvent>[0]) => repo.addTraceEvent(event);
