// Session services shared by the Supervisor and the HTTP routes: derived views (recommendations, timetable,
// explanations) and audited mode changes. Numbers always come from the engines (spec 4 design rule).
import {
  confidenceLabel,
  DEFAULT_WEIGHTS,
  INTERVIEW_BUDGET,
  type CreateSessionBody,
  type Explanation,
  type Mode,
  type ProgrammeRules,
  type Recommendation,
  type RecommendationsResponse,
  type SessionState,
  type StudentProfile,
  type SwapSuggestion,
  type TimetableView,
} from '@modulematch/shared';
import { randomUUID } from 'node:crypto';
import { loadPathways, loadSocieties, rulesFor } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';
import { buildTimetable, checkShortlist, completeness, findClashes, profileHash, rankModules, suggestSwaps } from '../engines/index.ts';
import type { Tracer } from '../trace/tracer.ts';
import { explain } from './matcher.ts';
import { canTransition } from './modes.ts';

export const catalogue = {
  modules: () => repo.listModules(),
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
  };
}

export function timetableView(session: SessionState, recs = ranked(session)): TimetableView {
  const slots = catalogue.slots();
  const clashes = findClashes(session.shortlist, slots);
  const seen = new Set<string>();
  const swaps: SwapSuggestion[] = [];
  for (const clash of clashes) {
    for (const swap of suggestSwaps(session.profile, session.shortlist, clash, recs, slots)) {
      const key = `${swap.replaceModuleId}->${swap.withModuleId}`;
      if (!seen.has(key)) {
        seen.add(key);
        swaps.push(swap);
      }
    }
  }
  return {
    grids: buildTimetable(session.shortlist, slots),
    clashes,
    swaps,
    rules: checkShortlist(session.shortlist, session.profile, catalogue.modules(), rulesForProfile(session.profile)),
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

/** Explanations are cached by profile hash and module ID (spec 5 cost control). */
const explanationCache = new Map<string, Explanation>();

export function clearExplanationCache(): void {
  explanationCache.clear();
}

export async function explanationFor(session: SessionState, moduleId: string, tracer: Tracer, recs = ranked(session)): Promise<Explanation | null> {
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
