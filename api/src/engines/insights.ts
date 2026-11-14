// Spec 9.3: insights engine for module leads. Every number in an insight card comes from here; the
// Insights agent only words them. Privacy (spec 20.4): nothing is reported for a cohort under MIN_COHORT.
import { MIN_COHORT, TOPIC_IDS } from '@modulematch/shared';
import type { Insight, InsightKind, Module, ModuleDemand, Slot, StudentProfile, TopicId, Weights } from '@modulematch/shared';
import { scoreModule, type TopicWeights } from './scoring.ts';
import { clashLabel, clashPriorities } from './timetable.ts';
import { clamp01, compareIds, mean, moduleName, roundTo, topicLabel } from './util.ts';

/** Spec 9.3: S_m holds students with interest alignment at least this... */
export const INTERESTED_ALIGNMENT = 0.5;
/** ...whose fit is still below this. */
export const CONVINCED_FIT = 75;
/** Spec 9.3 candidate change: a missing topic is added at this weight. */
export const ADDED_TOPIC_WEIGHT = 0.3;
/** Spec 9.3 candidate change: demand fields move by this amount. */
export const DEMAND_SHIFT = 0.2;
/** Spec 9.3: the top three changes are reported. */
export const MAX_COUNTERFACTUALS = 3;
/** Spec 9.3 OVERLOOKED: shortlisting below this share of capacity. */
export const OVERLOOKED_CAPACITY_SHARE = 0.2;
/** DEMAND cards are raised once shortlists reach this share of capacity. */
export const HIGH_DEMAND_CAPACITY_SHARE = 0.9;
/** Spec 9.3 CLASH: the module appears in one of the top ten clash priority pairs. */
export const TOP_CLASH_PAIRS = 10;

const HISTOGRAM_BUCKETS = 10;

/** A single edit to a module's derived fields, tested by re-scoring the interested-but-unconvinced group. */
export type ModuleChange =
  | { kind: 'add-topic'; topic: TopicId; weight: number }
  | { kind: 'shift-demand'; field: keyof ModuleDemand; delta: number };

export interface Counterfactual {
  change: ModuleChange;
  /** Staff-facing description, for example "Lower maths intensity from 0.80 to 0.60". */
  description: string;
  /** Δ_δ: mean fit change in points across the group. */
  uplift: number;
  groupSize: number;
}

export interface CohortStats {
  cohortSize: number;
  shortlisted: number;
  /** Mean fit across the cohort, 0 to 100, to one decimal place. */
  averageFit: number;
  /** Students per fit band: 0–9, 10–19, …, 90–100. */
  fitHistogram: number[];
}

/** Everything the insight builders need about the cohort, catalogue and timetable. */
export interface InsightContext {
  /** The whole catalogue: used for the median fit and to name clash partners. */
  modules: readonly Module[];
  cohort: readonly StudentProfile[];
  /** One shortlist per cohort student. */
  shortlists: readonly (readonly string[])[];
  weights: Weights;
  /** The seeded cohort is a single programme, so one set of home topics serves every student. */
  homeTopics: TopicWeights;
  slots: readonly Slot[];
}

const DEMAND_LABELS: Record<keyof ModuleDemand, string> = {
  examShare: 'exam share',
  groupShare: 'group work share',
  applied: 'applied content',
  mathsIntensity: 'maths intensity',
  codingIntensity: 'coding intensity',
  workload: 'workload',
};

/** Spec 9.3 demand changes: exam share ±0.2, maths, coding and workload −0.2. */
const DEMAND_CHANGES: readonly { field: keyof ModuleDemand; delta: number }[] = [
  { field: 'examShare', delta: DEMAND_SHIFT },
  { field: 'examShare', delta: -DEMAND_SHIFT },
  { field: 'mathsIntensity', delta: -DEMAND_SHIFT },
  { field: 'codingIntensity', delta: -DEMAND_SHIFT },
  { field: 'workload', delta: -DEMAND_SHIFT },
];

const insightId = (moduleId: string, kind: InsightKind, n: number): string => `${moduleId}:${kind}:${n}`;

const fitsFor = (module: Module, cohort: readonly StudentProfile[], weights: Weights, homeTopics: TopicWeights) =>
  cohort.map((student) => scoreModule(student, module, weights, homeTopics).fit);

/** Average fit to one decimal place, as shown to staff. */
const averageOf = (fits: readonly number[]): number => roundTo(mean(fits), 1);

const countShortlisted = (moduleId: string, shortlists: InsightContext['shortlists']): number =>
  shortlists.filter((shortlist) => shortlist.includes(moduleId)).length;

function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function candidateChanges(module: Module): ModuleChange[] {
  const missingTopics = TOPIC_IDS.filter((topic) => (module.topics[topic] ?? 0) === 0);
  return [
    ...missingTopics.map((topic): ModuleChange => ({ kind: 'add-topic', topic, weight: ADDED_TOPIC_WEIGHT })),
    ...DEMAND_CHANGES.map((change): ModuleChange => ({ kind: 'shift-demand', ...change })),
  ];
}

function applyChange(module: Module, change: ModuleChange): Module {
  switch (change.kind) {
    case 'add-topic':
      return { ...module, topics: { ...module.topics, [change.topic]: change.weight } };
    case 'shift-demand':
      return {
        ...module,
        demand: { ...module.demand, [change.field]: clamp01(module.demand[change.field] + change.delta) },
      };
  }
}

function describeChange(module: Module, change: ModuleChange): string {
  switch (change.kind) {
    case 'add-topic':
      return `Add ${topicLabel(change.topic)} content at topic weight ${change.weight}`;
    case 'shift-demand': {
      const from = module.demand[change.field];
      const to = clamp01(from + change.delta);
      return `${change.delta > 0 ? 'Raise' : 'Lower'} ${DEMAND_LABELS[change.field]} from ${from.toFixed(2)} to ${to.toFixed(2)}`;
    }
  }
}

/** Spec 9.3: S_m = { s : I(s,m) ≥ 0.5 and Fit(s,m) < 75 }. */
export function interestedButUnconvinced(
  module: Module,
  cohort: readonly StudentProfile[],
  weights: Weights,
  homeTopics: TopicWeights,
): StudentProfile[] {
  return cohort.filter((student) => {
    const { sub, fit } = scoreModule(student, module, weights, homeTopics);
    return sub.interest >= INTERESTED_ALIGNMENT && fit < CONVINCED_FIT;
  });
}

/**
 * Spec 9.3: re-score S_m under each candidate change and report Δ_δ, the mean fit uplift. Returns the
 * top MAX_COUNTERFACTUALS changes with positive uplift, or nothing when |S_m| < MIN_COHORT.
 */
export function counterfactuals(
  module: Module,
  cohort: readonly StudentProfile[],
  weights: Weights,
  homeTopics: TopicWeights,
): Counterfactual[] {
  const group = interestedButUnconvinced(module, cohort, weights, homeTopics);
  if (group.length < MIN_COHORT) return [];
  const baseline = mean(fitsFor(module, group, weights, homeTopics));
  return candidateChanges(module)
    .map((change) => ({
      change,
      description: describeChange(module, change),
      // The mean of per-student differences equals the difference of the means.
      uplift: mean(fitsFor(applyChange(module, change), group, weights, homeTopics)) - baseline,
      groupSize: group.length,
    }))
    .filter((counterfactual) => counterfactual.uplift > 0)
    .sort((a, b) => b.uplift - a.uplift || compareIds(a.description, b.description))
    .slice(0, MAX_COUNTERFACTUALS);
}

/** Fields for StaffModuleSummary. Null when the cohort is under MIN_COHORT (spec 20.4). */
export function cohortStats(
  module: Module,
  cohort: readonly StudentProfile[],
  shortlists: InsightContext['shortlists'],
  weights: Weights,
  homeTopics: TopicWeights,
): CohortStats | null {
  if (cohort.length < MIN_COHORT) return null;
  const fits = fitsFor(module, cohort, weights, homeTopics);
  const bucketOf = (fit: number) => Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(fit / HISTOGRAM_BUCKETS));
  return {
    cohortSize: cohort.length,
    shortlisted: countShortlisted(module.id, shortlists),
    averageFit: averageOf(fits),
    fitHistogram: Array.from({ length: HISTOGRAM_BUCKETS }, (_, bucket) => fits.filter((fit) => bucketOf(fit) === bucket).length),
  };
}

function counterfactualInsights(module: Module, ctx: InsightContext): Insight[] {
  return counterfactuals(module, ctx.cohort, ctx.weights, ctx.homeTopics).map((counterfactual, i) => {
    const points = counterfactual.uplift.toFixed(1);
    return {
      id: insightId(module.id, 'COUNTERFACTUAL', i + 1),
      moduleId: module.id,
      kind: 'COUNTERFACTUAL',
      headline: `${counterfactual.description}: +${points} fit points for ${counterfactual.groupSize} interested students`,
      detail: `${counterfactual.groupSize} students have interest alignment of at least ${INTERESTED_ALIGNMENT} with ${moduleName(module)} but a fit below ${CONVINCED_FIT}. Re-scoring them with this change raises their average fit by ${points} points.`,
      cohortSize: counterfactual.groupSize,
      upliftPoints: roundTo(counterfactual.uplift, 1),
      decision: 'pending',
    };
  });
}

/**
 * Spec 9.3 OVERLOOKED: the cohort's average fit is above the catalogue median, yet shortlisting is below
 * 20% of capacity. Needs a known capacity and a cohort of at least MIN_COHORT.
 */
export function overlooked(module: Module, ctx: InsightContext): Insight | null {
  const stats = cohortStats(module, ctx.cohort, ctx.shortlists, ctx.weights, ctx.homeTopics);
  if (stats === null || module.capacity === null) return null;
  const catalogueMedian = median(ctx.modules.map((m) => averageOf(fitsFor(m, ctx.cohort, ctx.weights, ctx.homeTopics))));
  const capacityShare = stats.shortlisted / module.capacity;
  if (stats.averageFit <= catalogueMedian || capacityShare >= OVERLOOKED_CAPACITY_SHARE) return null;
  return {
    id: insightId(module.id, 'OVERLOOKED', 1),
    moduleId: module.id,
    kind: 'OVERLOOKED',
    headline: `Overlooked: average fit ${stats.averageFit.toFixed(1)} against a catalogue median of ${catalogueMedian.toFixed(1)}, but only ${stats.shortlisted} shortlists`,
    detail: `Across ${stats.cohortSize} students, ${moduleName(module)} has an average fit of ${stats.averageFit.toFixed(1)}, above the catalogue median of ${catalogueMedian.toFixed(1)}. Only ${stats.shortlisted} students shortlisted it, ${Math.round(100 * capacityShare)}% of its ${module.capacity} places.`,
    cohortSize: stats.cohortSize,
    upliftPoints: null,
    decision: 'pending',
  };
}

/**
 * Spec 9.3 DEMAND: projected demand (cohort shortlists) against capacity, raised once shortlists reach
 * HIGH_DEMAND_CAPACITY_SHARE of the places. Needs at least MIN_COHORT shortlisting students.
 */
export function demand(module: Module, ctx: InsightContext): Insight | null {
  if (module.capacity === null) return null;
  const shortlisted = countShortlisted(module.id, ctx.shortlists);
  const capacityShare = shortlisted / module.capacity;
  if (shortlisted < MIN_COHORT || capacityShare < HIGH_DEMAND_CAPACITY_SHARE) return null;
  const percent = Math.round(100 * capacityShare);
  return {
    id: insightId(module.id, 'DEMAND', 1),
    moduleId: module.id,
    kind: 'DEMAND',
    headline: `${capacityShare > 1 ? 'Oversubscribed' : 'Near capacity'}: ${shortlisted} shortlists for ${module.capacity} places (${percent}%)`,
    detail: `${shortlisted} students have shortlisted ${moduleName(module)}, which has ${module.capacity} places. Projected demand is ${percent}% of capacity.`,
    cohortSize: shortlisted,
    upliftPoints: null,
    decision: 'pending',
  };
}

/**
 * Spec 9.3 CLASH: one card per top-ten clash priority pair that includes the module, skipping pairs
 * shared by fewer than MIN_COHORT students.
 */
export function clashInsights(module: Module, ctx: InsightContext): Insight[] {
  const top = clashPriorities(ctx.shortlists, ctx.slots).slice(0, TOP_CLASH_PAIRS);
  const named = (moduleId: string) => {
    const found = ctx.modules.find((m) => m.id === moduleId);
    return found ? moduleName(found) : moduleId;
  };
  return top
    .map((pair, index) => ({ pair, rank: index + 1 }))
    .filter(({ pair }) => (pair.moduleA === module.id || pair.moduleB === module.id) && pair.students >= MIN_COHORT)
    .map(({ pair, rank }, i): Insight => {
      const partner = named(pair.moduleA === module.id ? pair.moduleB : pair.moduleA);
      const percent = Math.round(100 * pair.probability);
      return {
        id: insightId(module.id, 'CLASH', i + 1),
        moduleId: module.id,
        kind: 'CLASH',
        headline: `Timetable clash with ${partner} affects ${pair.students} students (${clashLabel(pair.probability)}, ${percent}%)`,
        detail: `${pair.students} students shortlisted both ${moduleName(module)} and ${partner}. Their slots clash with probability ${percent}%, giving a priority of ${pair.priority.toFixed(1)}, number ${rank} of the top ${top.length} clash pairs.`,
        cohortSize: pair.students,
        upliftPoints: null,
        decision: 'pending',
      };
    });
}

/** Every insight card for one module, each awaiting a staff decision (spec 10.7). */
export function buildInsights(module: Module, ctx: InsightContext): Insight[] {
  return [
    ...counterfactualInsights(module, ctx),
    ...[overlooked(module, ctx), demand(module, ctx)].filter((insight) => insight !== null),
    ...clashInsights(module, ctx),
  ];
}
