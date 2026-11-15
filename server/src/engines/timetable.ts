// Spec 9.2: timetable engine. Term grids, clash probabilities, swap suggestions, kept-free time and staff clash
// priorities. The student's plan is the shortlist plus the compulsory core modules for their year.
import { LIKELY_CLASH_THRESHOLD, schemas, SWAP_FIT_TOLERANCE } from '@modulematch/shared';
import type {
  Clash,
  ClashLabel,
  CapacityBackup,
  ClashPriority,
  KeepFreeConflict,
  KeepFreeWindow,
  Module,
  ModuleDemandSignal,
  ProgrammeRules,
  Recommendation,
  RuleViolation,
  RulesResult,
  Slot,
  StudentProfile,
  SwapSuggestion,
  TermGrid,
  TimetableView,
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

/**
 * The core modules in this year's plan: the programme's compulsory modules the student has not completed.
 * They are on every timetable and count in clash detection, but are never swapped (spec 9.2).
 */
export function coreInPlan(rules: ProgrammeRules, profile: StudentProfile): string[] {
  const completed = new Set(profile.completedModuleIds);
  return unique(rules.coreModuleIds.filter((id) => !completed.has(id)));
}

/** Spec 9.2: one grid per term that has slots for the given modules (shortlist plus core), in autumn, spring, summer order. */
export function buildTimetable(moduleIds: readonly string[], slots: readonly Slot[]): TermGrid[] {
  const chosen = new Set(moduleIds);
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

/**
 * Spec 9.2: every clashing pair in the shortlist and against the core modules, most probable first. moduleA
 * sorts before moduleB. Two core modules are never paired: the department timetables them together, and the
 * student can change neither.
 */
export function findClashes(shortlist: readonly string[], slots: readonly Slot[], core: readonly string[] = []): Clash[] {
  const byModule = slotsByModule(slots);
  const fixed = new Set(core);
  return pairs(unique([...shortlist, ...core]).sort(compareIds))
    .filter(([a, b]) => !(fixed.has(a) && fixed.has(b)))
    .flatMap(([a, b]) => clashesBetween(a, b, byModule))
    .sort(
      (x, y) =>
        y.probability - x.probability ||
        compareIds(x.moduleA, y.moduleA) ||
        compareIds(x.moduleB, y.moduleB) ||
        TERMS.indexOf(x.term) - TERMS.indexOf(y.term),
    );
}

// ---------- kept-free time (interview question 8): a soft constraint that never changes fit or ranking ----------

/** Half days split at noon. A whole day or an afternoon runs to the end of the day, so late sessions count too. */
const NOON = '12:00';
const DAY_OPEN = '00:00';
const DAY_CLOSE = '23:59';

/**
 * The student's keep-free answers as windows on the week: whole days, half days ("Wednesday afternoons") and
 * the time before their earliest start on every weekday. A whole day covers that day's half days and early
 * start, and a kept-free morning covers the early start, so one window at most covers any moment. Week order.
 */
export function keepFreeWindows(prefs: StudentProfile['timetablePrefs']): KeepFreeWindow[] {
  const days = new Set(prefs.avoidDays);
  const halves = new Set(prefs.avoidHalfDays ?? []);
  return WEEKDAYS.flatMap((day): KeepFreeWindow[] => {
    if (days.has(day)) return [{ day, from: DAY_OPEN, to: DAY_CLOSE, reason: 'day' }];
    const windows: KeepFreeWindow[] = [];
    const morning = halves.has(`${day}-am`);
    const afternoon = halves.has(`${day}-pm`);
    const early = prefs.earliestStart && toMinutes(prefs.earliestStart) > 0 ? prefs.earliestStart : null;
    if (morning) windows.push({ day, from: DAY_OPEN, to: NOON, reason: 'half-day' });
    if (early) {
      // The early-start window only covers what the half days leave uncovered, so windows never overlap.
      const from = morning ? NOON : DAY_OPEN;
      const to = afternoon && toMinutes(early) > toMinutes(NOON) ? NOON : early;
      if (toMinutes(to) > toMinutes(from)) windows.push({ day, from, to, reason: 'early' });
    }
    if (afternoon) windows.push({ day, from: NOON, to: DAY_CLOSE, reason: 'half-day' });
    return windows;
  });
}

const inWindow = (slot: Slot, window: KeepFreeWindow): boolean =>
  slot.day === window.day &&
  Math.max(toMinutes(slot.start), toMinutes(window.from)) < Math.min(toMinutes(slot.end), toMinutes(window.to));

/**
 * Soft conflicts: each session of the given modules that falls in kept-free time, in weekly order. A provisional
 * candidate time counts too, since the student would want to know a session might land there.
 */
export function keepFreeConflicts(
  moduleIds: readonly string[],
  slots: readonly Slot[],
  windows: readonly KeepFreeWindow[],
): KeepFreeConflict[] {
  if (windows.length === 0) return [];
  const chosen = new Set(moduleIds);
  return slots
    .filter((slot) => chosen.has(slot.moduleId))
    .sort(bySlotTime)
    .flatMap((slot): KeepFreeConflict[] => {
      const window = windows.find((candidate) => inWindow(slot, candidate));
      return window ? [{ moduleId: slot.moduleId, slot, window }] : [];
    });
}

/** What a swap is checked against: the catalogue, the programme rules and the rules check for a shortlist. */
export interface SwapPlan {
  modules: readonly Module[];
  rules: ProgrammeRules;
  /** The programme rules check (spec 9.1) for a shortlist, with whatever session details it needs. */
  check: (shortlist: readonly string[]) => RulesResult;
  /** The student's kept-free time. Swaps that keep it free come first; it never rules a swap out. */
  keepFree?: readonly KeepFreeWindow[];
}

type ModuleKind = Module['type'];

const violationKey = (violation: RuleViolation): string => JSON.stringify([violation.code, violation.moduleId]);

/** Swaps that keep the student's kept-free time free come first, then best fit, then by id for a stable order. */
const bySwapPreference = (x: SwapSuggestion, y: SwapSuggestion): number =>
  Number(x.keepFreeConflicts > 0) - Number(y.keepFreeConflicts > 0) ||
  y.fit - x.fit ||
  compareIds(x.replaceModuleId, y.replaceModuleId) ||
  compareIds(x.withModuleId, y.withModuleId);

/**
 * Every module that could replace `target` in the shortlist, with the checks spec 9.2 swaps use: eligible, of
 * the same kind (elective for elective, I-Explore for I-Explore), not already shortlisted or completed, free of
 * clashes with the rest of the shortlist and the core modules, and adding no rules violation that was not there
 * before, nor deepening a credit shortfall or overrun that was. With a `fitTolerance`, it must also fit within
 * that many points of the target. Core modules are compulsory, so they are never replaced. Best first.
 */
export function swapCandidates(
  profile: StudentProfile,
  shortlist: readonly string[],
  target: string,
  ranked: readonly Recommendation[],
  slots: readonly Slot[],
  plan: SwapPlan,
  fitTolerance: number | null,
): SwapSuggestion[] {
  const byId = new Map(plan.modules.map((module) => [module.id, module]));
  const core = new Set(plan.rules.coreModuleIds);
  const kindOf = (id: string): ModuleKind | null => (core.has(id) ? 'core' : (byId.get(id)?.type ?? null));
  const targetKind = kindOf(target);
  if (targetKind === null || targetKind === 'core') return [];

  const fitOf = new Map(ranked.map((recommendation) => [recommendation.moduleId, recommendation.fit]));
  const targetFit = fitOf.get(target) ?? 0;
  const targetEcts = byId.get(target)?.ects ?? 0;
  const unavailable = new Set([...shortlist, ...profile.completedModuleIds]);
  const byModule = slotsByModule(slots);
  const rest = shortlist.filter((id) => id !== target);
  const fixed = unique([...rest, ...coreInPlan(plan.rules, profile)]);
  const keepFree = plan.keepFree ?? [];
  const before = new Set(plan.check(shortlist).violations.map(violationKey));
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
        (fitTolerance === null || candidate.fit >= targetFit - fitTolerance) &&
        fixed.every((other) => clashesBetween(candidate.moduleId, other, byModule).length === 0) &&
        keepsRules(candidate.moduleId),
    )
    .map((candidate) => ({
      replaceModuleId: target,
      withModuleId: candidate.moduleId,
      fit: candidate.fit,
      fitDelta: candidate.fit - targetFit,
      keepFreeConflicts: keepFreeConflicts([candidate.moduleId], byModule.get(candidate.moduleId) ?? [], keepFree).length,
    }))
    .sort(bySwapPreference);
}

/**
 * Spec 9.2: swaps for the lower-fit module in a clash (both when their fits are equal), from swapCandidates
 * within SWAP_FIT_TOLERANCE of the module they replace. Swaps that keep the student's kept-free time free come
 * first, then best fit, top MAX_SWAPS.
 */
export function suggestSwaps(
  profile: StudentProfile,
  shortlist: readonly string[],
  clash: Clash,
  ranked: readonly Recommendation[],
  slots: readonly Slot[],
  plan: SwapPlan,
): SwapSuggestion[] {
  const core = new Set(plan.rules.coreModuleIds);
  const byId = new Map(plan.modules.map((module) => [module.id, module]));
  const swappable = (id: string): boolean => !core.has(id) && byId.has(id) && byId.get(id)?.type !== 'core';
  const fitOf = new Map(ranked.map((recommendation) => [recommendation.moduleId, recommendation.fit]));
  const [lowest] = [clash.moduleA, clash.moduleB]
    .filter(swappable)
    .map((id) => fitOf.get(id) ?? 0)
    .sort((x, y) => x - y);
  const targets = [clash.moduleA, clash.moduleB].filter((id) => swappable(id) && (fitOf.get(id) ?? 0) === lowest);
  return targets
    .flatMap((target) => swapCandidates(profile, shortlist, target, ranked, slots, plan, SWAP_FIT_TOLERANCE))
    .sort(bySwapPreference)
    .slice(0, MAX_SWAPS);
}

/**
 * A pick has a backup on the shortlist when the plan would still meet the programme rules without it: dropping it
 * adds no rules violation, and leaves no elective credit shortfall, which dropping a module can only create or
 * deepen. That is the case once the student has shortlisted more than the rules need, such as an extra elective.
 */
function hasBackupFor(target: string, shortlist: readonly string[], plan: SwapPlan, before: ReadonlySet<string>): boolean {
  return plan
    .check(shortlist.filter((id) => id !== target))
    .violations.every((violation) => before.has(violationKey(violation)) && violation.code !== 'ELECTIVE_ECTS_SHORT');
}

/**
 * Issue #68: for each shortlisted option that the cohort's demand puts near or over capacity, the best backup.
 * It is the best-fitting swap candidate (the same checks as swapCandidates, with no fit tolerance) that is not
 * near capacity itself. `canAdd` says it can also sit beside the popular pick: no clash with it, no new rules
 * violation from keeping both, and no ECTS overrun, since adding a module only ever deepens one that is already
 * there. A pick that already has a backup on the shortlist gets no suggestion (see hasBackupFor). Informational:
 * fit and rank are unchanged.
 */
export function capacityBackups(
  profile: StudentProfile,
  shortlist: readonly string[],
  ranked: readonly Recommendation[],
  slots: readonly Slot[],
  plan: SwapPlan,
  demand: ReadonlyMap<string, ModuleDemandSignal>,
): CapacityBackup[] {
  const byModule = slotsByModule(slots);
  const before = new Set(plan.check(shortlist).violations.map(violationKey));
  return shortlist.flatMap((target) => {
    const signal = demand.get(target);
    if (!signal || hasBackupFor(target, shortlist, plan, before)) return [];
    const best = swapCandidates(profile, shortlist, target, ranked, slots, plan, null).find((c) => !demand.has(c.withModuleId));
    if (!best) return [];
    const canAdd =
      clashesBetween(best.withModuleId, target, byModule).length === 0 &&
      plan
        .check([...shortlist, best.withModuleId])
        .violations.every((violation) => before.has(violationKey(violation)) && violation.code !== 'ECTS_CAP_EXCEEDED');
    return [{ ...best, status: signal.status, canAdd }];
  });
}

/**
 * ECTS in the plan by kind (core, chosen electives, I-Explore) against the programme cap (null when the rules for
 * the student's year are not loaded). It counts every core
 * module, as the spec 9.1 rules check does, so the bar and the rules always agree on how much room is left.
 */
export function planEcts(shortlist: readonly string[], modules: readonly Module[], rules: ProgrammeRules): TimetableView['ects'] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const coreIds = new Set(rules.coreModuleIds);
  // Without the year's rules there is no cap to plan towards, so none is invented (issue 51).
  const ects = { core: 0, elective: 0, iExplore: 0, max: rules.loaded ? rules.maxEcts : null };
  for (const module of unique([...rules.coreModuleIds, ...shortlist]).flatMap((id) => byId.get(id) ?? [])) {
    if (coreIds.has(module.id) || module.type === 'core') ects.core += module.ects;
    else if (module.type === 'i-explore') ects.iExplore += module.ects;
    else ects.elective += module.ects;
  }
  return ects;
}

/**
 * Spec 9.2: the student's week. The shortlist and this year's core modules on term grids, the clashes among
 * them (core included), de-duplicated swaps for each clash, and the kept-free windows with the shortlisted
 * sessions that fall in them. Core sessions are never flagged as kept-free conflicts: the student cannot move
 * them. The rules check is left to the caller, which knows the session's details.
 */
export function planTimetable(
  profile: StudentProfile,
  shortlist: readonly string[],
  ranked: readonly Recommendation[],
  slots: readonly Slot[],
  plan: SwapPlan,
  /** Cohort demand for capped modules near or over capacity; picks among them get a backup (issue #68). */
  demand: ReadonlyMap<string, ModuleDemandSignal> = new Map(),
): Omit<TimetableView, 'rules'> {
  const core = coreInPlan(plan.rules, profile);
  const keepFree = [...(plan.keepFree ?? keepFreeWindows(profile.timetablePrefs))];
  const clashes = findClashes(shortlist, slots, core);
  const swaps = new Map<string, SwapSuggestion>();
  for (const clash of clashes) {
    for (const swap of suggestSwaps(profile, shortlist, clash, ranked, slots, { ...plan, keepFree })) {
      const key = JSON.stringify([swap.replaceModuleId, swap.withModuleId]);
      if (!swaps.has(key)) swaps.set(key, swap);
    }
  }
  const coreSet = new Set(core);
  return {
    grids: buildTimetable([...shortlist, ...core], slots),
    coreModuleIds: core,
    clashes,
    swaps: [...swaps.values()],
    backups: capacityBackups(profile, shortlist, ranked, slots, { ...plan, keepFree }, demand),
    keepFree,
    keepFreeConflicts: keepFreeConflicts(
      shortlist.filter((id) => !coreSet.has(id)),
      slots,
      keepFree,
    ),
    ects: planEcts(shortlist, plan.modules, plan.rules),
  };
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
