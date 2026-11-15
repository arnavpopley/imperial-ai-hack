// Spec 9.2: timetable engine. Term grids, clash probabilities, swap suggestions and staff clash priorities.
import { LIKELY_CLASH_THRESHOLD, schemas, SWAP_FIT_TOLERANCE } from '@modulematch/shared';
import type {
  Clash,
  ClashLabel,
  ClashPriority,
  Module,
  ProgrammeRules,
  Recommendation,
  RuleViolation,
  RulesResult,
  Slot,
  StudentProfile,
  SwapSuggestion,
  TermGrid,
} from '@modulematch/shared';
import { clamp01, compareIds, groupBy, pairs, TERMS, unique } from './util.ts';

/** A clash probability within this distance of 1 is labelled certain (spec 9.2). */
export const CERTAIN_EPSILON = 1e-9;
/** Swap suggestions returned per clash. */
export const MAX_SWAPS = 3;

const WEEKDAYS = schemas.Weekday.options;

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Spec 9.2: same term, same day, and max(start) < min(end). Touching slots (one ends as the next starts) do not overlap. */
export function overlap(a: Slot, b: Slot): boolean {
  return (
    a.term === b.term &&
    a.day === b.day &&
    Math.max(toMinutes(a.start), toMinutes(b.start)) < Math.min(toMinutes(a.end), toMinutes(b.end))
  );
}

/** Slots in weekly reading order: day, start time, then module and session for a stable tie-break. */
const bySlotTime = (a: Slot, b: Slot): number =>
  WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) ||
  toMinutes(a.start) - toMinutes(b.start) ||
  compareIds(a.moduleId, b.moduleId) ||
  compareIds(a.sessionKey, b.sessionKey);

const slotsByModule = (slots: readonly Slot[]): Map<string, Slot[]> => groupBy(slots, (slot) => slot.moduleId);

/** Spec 9.2: one grid per term that has shortlisted slots, in autumn, spring, summer order. */
export function buildTimetable(shortlist: readonly string[], slots: readonly Slot[]): TermGrid[] {
  const chosen = new Set(shortlist);
  const shortlisted = slots.filter((slot) => chosen.has(slot.moduleId)).sort(bySlotTime);
  return TERMS.flatMap((term) => {
    const termSlots = shortlisted.filter((slot) => slot.term === term);
    return termSlots.length > 0 ? [{ term, slots: termSlots }] : [];
  });
}

/** A teaching session is one sessionKey within one term, so a key reused in another term is a separate session. */
const sessionsOf = (slots: readonly Slot[]): Slot[][] => [
  ...groupBy(slots, (slot) => JSON.stringify([slot.term, slot.sessionKey])).values(),
];

/**
 * Spec 9.2: the chance that at least one pair of teaching sessions overlaps. Each session's candidates
 * (grouped by term and sessionKey) carry probabilities π; per session pair P = Σ π_a π_b 1[overlap],
 * and the pairs combine as 1 − Π (1 − P), treating sessions as independent.
 */
export function clashProbability(slotsI: readonly Slot[], slotsJ: readonly Slot[]): number {
  const sessionsI = sessionsOf(slotsI);
  const sessionsJ = sessionsOf(slotsJ);
  let noClash = 1;
  for (const x of sessionsI) {
    for (const y of sessionsJ) {
      let sessionPair = 0;
      for (const a of x) for (const b of y) if (overlap(a, b)) sessionPair += a.probability * b.probability;
      noClash *= 1 - clamp01(sessionPair);
    }
  }
  return clamp01(1 - noClash);
}

/** Spec 9.2 labels: certain at P = 1, likely for 0.3 ≤ P < 1, possible for 0 < P < 0.3. */
export function clashLabel(probability: number): ClashLabel {
  if (probability >= 1 - CERTAIN_EPSILON) return 'certain';
  return probability >= LIKELY_CLASH_THRESHOLD ? 'likely' : 'possible';
}

/** Clashes between two modules, at most one per term, with the overlapping slot pairs. */
function clashesBetween(moduleA: string, moduleB: string, byModule: Map<string, Slot[]>): Clash[] {
  const slotsA = byModule.get(moduleA) ?? [];
  const slotsB = byModule.get(moduleB) ?? [];
  return TERMS.flatMap((term): Clash[] => {
    const termA = slotsA.filter((slot) => slot.term === term);
    const termB = slotsB.filter((slot) => slot.term === term);
    const probability = clashProbability(termA, termB);
    if (probability <= 0) return [];
    const overlaps = termA.flatMap((a) => termB.filter((b) => overlap(a, b)).map((b) => ({ a, b })));
    return [{ moduleA, moduleB, term, probability, label: clashLabel(probability), overlaps }];
  });
}

/** Spec 9.2: every clashing pair in the shortlist, most probable first. moduleA sorts before moduleB. */
export function findClashes(shortlist: readonly string[], slots: readonly Slot[]): Clash[] {
  const byModule = slotsByModule(slots);
  return pairs(unique(shortlist).sort(compareIds))
    .flatMap(([a, b]) => clashesBetween(a, b, byModule))
    .sort(
      (x, y) =>
        y.probability - x.probability ||
        compareIds(x.moduleA, y.moduleA) ||
        compareIds(x.moduleB, y.moduleB) ||
        TERMS.indexOf(x.term) - TERMS.indexOf(y.term),
    );
}

/** What a swap is checked against: the catalogue, the programme rules and the rules check for a shortlist. */
export interface SwapPlan {
  modules: readonly Module[];
  rules: ProgrammeRules;
  /** The programme rules check (spec 9.1) for a shortlist, with whatever session details it needs. */
  check: (shortlist: readonly string[]) => RulesResult;
}

type ModuleKind = Module['type'];

const violationKey = (violation: RuleViolation): string => JSON.stringify([violation.code, violation.moduleId]);

/**
 * Spec 9.2: swaps for the lower-fit module in a clash (both when their fits are equal). Core modules are
 * compulsory, so they are never replaced or offered. An alternative must be eligible, of the same kind as
 * the module it replaces (elective for elective, I-Explore for I-Explore), not already shortlisted or
 * completed, free of clashes with the rest of the shortlist and the core modules, and within
 * SWAP_FIT_TOLERANCE of the module it replaces. It must not add a rules violation that was not there before
 * the swap, or deepen a credit shortfall or overrun that was. Best fit first, top MAX_SWAPS.
 */
export function suggestSwaps(
  profile: StudentProfile,
  shortlist: readonly string[],
  clash: Clash,
  ranked: readonly Recommendation[],
  slots: readonly Slot[],
  plan: SwapPlan,
): SwapSuggestion[] {
  const byId = new Map(plan.modules.map((module) => [module.id, module]));
  const core = new Set(plan.rules.coreModuleIds);
  const kindOf = (id: string): ModuleKind | null => (core.has(id) ? 'core' : (byId.get(id)?.type ?? null));
  const swappable = (id: string): boolean => {
    const kind = kindOf(id);
    return kind !== null && kind !== 'core';
  };

  const fitOf = new Map(ranked.map((recommendation) => [recommendation.moduleId, recommendation.fit]));
  const [lowest] = [clash.moduleA, clash.moduleB]
    .filter(swappable)
    .map((id) => fitOf.get(id) ?? 0)
    .sort((x, y) => x - y);
  const targets = [clash.moduleA, clash.moduleB].filter((id) => swappable(id) && (fitOf.get(id) ?? 0) === lowest);
  const completed = new Set(profile.completedModuleIds);
  const unavailable = new Set([...shortlist, ...completed]);
  const byModule = slotsByModule(slots);
  const before = new Set(plan.check(shortlist).violations.map(violationKey));

  return targets
    .flatMap((target) => {
      const targetFit = fitOf.get(target) ?? 0;
      const targetKind = kindOf(target);
      const targetEcts = byId.get(target)?.ects ?? 0;
      const rest = shortlist.filter((id) => id !== target);
      const fixed = unique([...rest, ...plan.rules.coreModuleIds.filter((id) => !completed.has(id))]);
      const keepsRules = (candidateId: string): boolean => {
        const ectsChange = (byId.get(candidateId)?.ects ?? 0) - targetEcts;
        return plan.check([...rest, candidateId]).violations.every(
          (violation) =>
            before.has(violationKey(violation)) &&
            !(violation.code === 'ELECTIVE_ECTS_SHORT' && ectsChange < 0) &&
            !(violation.code === 'ECTS_CAP_EXCEEDED' && ectsChange > 0),
        );
      };
      return ranked
        .filter(
          (candidate) =>
            candidate.eligible &&
            !unavailable.has(candidate.moduleId) &&
            kindOf(candidate.moduleId) === targetKind &&
            candidate.fit >= targetFit - SWAP_FIT_TOLERANCE &&
            fixed.every((other) => clashesBetween(candidate.moduleId, other, byModule).length === 0) &&
            keepsRules(candidate.moduleId),
        )
        .map((candidate) => ({
          replaceModuleId: target,
          withModuleId: candidate.moduleId,
          fit: candidate.fit,
          fitDelta: candidate.fit - targetFit,
        }));
    })
    .sort(
      (x, y) =>
        y.fit - x.fit ||
        compareIds(x.replaceModuleId, y.replaceModuleId) ||
        compareIds(x.withModuleId, y.withModuleId),
    )
    .slice(0, MAX_SWAPS);
}

/**
 * Spec 9.2 staff view: priority = n_ij · P(clash_ij), where n_ij counts students who shortlisted both
 * modules. Only pairs with n > 0 and P > 0, highest priority first.
 */
export function clashPriorities(cohortShortlists: readonly (readonly string[])[], slots: readonly Slot[]): ClashPriority[] {
  const students = new Map<string, { moduleA: string; moduleB: string; count: number }>();
  for (const shortlist of cohortShortlists) {
    for (const [moduleA, moduleB] of pairs(unique(shortlist).sort(compareIds))) {
      const key = JSON.stringify([moduleA, moduleB]);
      const entry = students.get(key) ?? { moduleA, moduleB, count: 0 };
      students.set(key, { ...entry, count: entry.count + 1 });
    }
  }
  const byModule = slotsByModule(slots);
  return [...students.values()]
    .flatMap(({ moduleA, moduleB, count }): ClashPriority[] => {
      const probability = clashProbability(byModule.get(moduleA) ?? [], byModule.get(moduleB) ?? []);
      return probability > 0 ? [{ moduleA, moduleB, students: count, probability, priority: count * probability }] : [];
    })
    .sort(
      (x, y) => y.priority - x.priority || compareIds(x.moduleA, y.moduleA) || compareIds(x.moduleB, y.moduleB),
    );
}
