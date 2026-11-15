// Spec 9.3: insights engine for module leads. Every number in an insight card comes from here; the
// Insights agent only words them. Privacy (spec 20.4): nothing is reported for a cohort under MIN_COHORT.
import { FIT_BAND_FLOORS, counterfactualInsightId, MIN_COHORT, STYLE_SLOTS, TOPIC_IDS } from '@modulematch/shared';
import type {
  Insight,
  InsightDecision,
  InsightKind,
  Module,
  ModuleDemand,
  ProgrammeRules,
  Slot,
  StudentProfile,
  SuggestedEdit,
  TopicId,
  Weights,
} from '@modulematch/shared';
import { checkModuleEligibility } from './rules.ts';
import { CAPABILITY_SLOTS, DEMAND_FIELD, scoreModule, type StyleSlot, type TopicWeights } from './scoring.ts';
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
/**
 * Spec 9.3: a change earns its own card only when it raises the group's average fit by at least this many
 * points. Smaller changes are merged into one summary card that names the main gap instead.
 */
export const MEANINGFUL_UPLIFT = 2;
/** Spec 9.3 impact: students whose fit would rise to at least this (the shared "strong fit" floor)... */
export const STRONG_FIT = FIT_BAND_FLOORS.strong;
/** ...and students who would then have the module among their top this-many eligible modules. */
export const TOP_MODULES = 5;
const TOP_MODULES_WORDS = 'top five';
/** Spec 9.3 OVERLOOKED: shortlisting below this share of capacity. */
export const OVERLOOKED_CAPACITY_SHARE = 0.2;
/** DEMAND cards are raised once shortlists reach this share of capacity. */
export const HIGH_DEMAND_CAPACITY_SHARE = 0.9;
/** Spec 9.3 CLASH: the module appears in one of the top ten clash priority pairs. */
export const TOP_CLASH_PAIRS = 10;
/** Modules with places left that an oversubscribed module's card suggests instead. */
export const MAX_ALTERNATIVES = 2;

const HISTOGRAM_BUCKETS = 10;

/** A single edit to a module's derived fields, tested by re-scoring the interested-but-unconvinced group. */
export type ModuleChange =
  | { kind: 'add-topic'; topic: TopicId; weight: number }
  | { kind: 'shift-demand'; field: keyof ModuleDemand; delta: number };

export interface Counterfactual {
  change: ModuleChange;
  /** Plain staff-facing wording, for example "Move 20% of the marks from the exam to coursework". */
  description: string;
  /** Δ_δ: mean fit change in points across the group. */
  uplift: number;
  groupSize: number;
  /** Students in the group who would newly have the module among their top TOP_MODULES modules. */
  newlyTopModules: number;
  /** Students in the group who already have it there. */
  alreadyTopModules: number;
  /** Students in the group whose fit would rise from below STRONG_FIT to at least STRONG_FIT. */
  crossStrongFit: number;
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
  /** The whole catalogue: used for the median fit, each student's top modules and to name other modules. */
  modules: readonly Module[];
  cohort: readonly StudentProfile[];
  /** One shortlist per cohort student. */
  shortlists: readonly (readonly string[])[];
  weights: Weights;
  /** The seeded cohort is a single programme, so one set of home topics serves every student. */
  homeTopics: TopicWeights;
  slots: readonly Slot[];
  /**
   * The cohort's programme rules. When given, a student's top modules are the ones they may take, as on
   * their own recommendations; without them every catalogue module counts.
   */
  rules?: ProgrammeRules;
}

/** Spec 9.3 demand changes: exam share ±0.2, maths, coding and workload −0.2. */
const DEMAND_CHANGES: readonly { field: keyof ModuleDemand; delta: number }[] = [
  { field: 'examShare', delta: DEMAND_SHIFT },
  { field: 'examShare', delta: -DEMAND_SHIFT },
  { field: 'mathsIntensity', delta: -DEMAND_SHIFT },
  { field: 'codingIntensity', delta: -DEMAND_SHIFT },
  { field: 'workload', delta: -DEMAND_SHIFT },
];

const insightId = (moduleId: string, kind: InsightKind, n: number | string): string => `${moduleId}:${kind}:${n}`;

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

// ---------- plain wording: cards carry no raw decimals or internal units ----------

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Shares of the content in words. */
const SHARE_WORDS: readonly (readonly [number, string])[] = [
  [0.1, 'a tenth'],
  [0.2, 'a fifth'],
  [0.25, 'a quarter'],
  [1 / 3, 'a third'],
  [0.4, 'two fifths'],
  [0.5, 'half'],
];

/** A share of the content in words, for example "about a quarter" for 0.23. */
export function shareInWords(share: number): string {
  if (share < 0.075) return 'a small part';
  const [, words] = SHARE_WORDS.reduce((best, entry) =>
    Math.abs(entry[0] - share) < Math.abs(best[0] - share) ? entry : best,
  );
  return `about ${words}`;
}

/** Plain levels for maths, coding and workload, one per fifth of the 0 to 1 scale. */
const LEVEL_WORDS = ['very light', 'light', 'moderate', 'demanding', 'very demanding'] as const;

/** A level in words, for example "demanding" for 0.7. Rounded first, so 0.6 − 0.2 is "moderate", not "light". */
export function levelInWords(value: number): string {
  const band = Math.floor(roundTo(clamp01(value), 2) * LEVEL_WORDS.length);
  return LEVEL_WORDS[Math.min(LEVEL_WORDS.length - 1, band)] ?? 'moderate';
}

const LEVEL_CHANGES: Record<Exclude<keyof ModuleDemand, 'examShare'>, string> = {
  groupShare: 'Change the group work',
  applied: 'Change the applied content',
  mathsIntensity: 'Ease the maths',
  codingIntensity: 'Ease the coding',
  workload: 'Reduce the workload',
};

/** Percentage points of a 0 to 1 share, for example 20 for a shift of 0.2. */
const percentPoints = (delta: number): number => Math.round(100 * Math.abs(delta));

function describeChange(module: Module, change: ModuleChange): string {
  switch (change.kind) {
    case 'add-topic': {
      const total = Object.values(module.topics).reduce((sum, weight) => sum + weight, 0);
      const share = change.weight / (total + change.weight);
      return `Add teaching on ${lowerFirst(topicLabel(change.topic))} (${shareInWords(share)} of the content)`;
    }
    case 'shift-demand': {
      const from = module.demand[change.field];
      const to = clamp01(from + change.delta);
      if (change.field === 'examShare')
        return to < from
          ? `Move ${percentPoints(to - from)}% of the marks from the exam to coursework`
          : `Move ${percentPoints(to - from)}% of the marks from coursework to the exam`;
      const subject = LEVEL_CHANGES[change.field];
      const [before, after] = [levelInWords(from), levelInWords(to)];
      return before === after ? `${subject} a little (it stays ${before})` : `${subject} from ${before} to ${after}`;
    }
  }
}

/** Fit points for a sentence: "less than one fit point" under 1, otherwise one decimal place. */
const pointsInWords = (points: number): string =>
  points < 1 ? 'less than one fit point' : `${points.toFixed(1)} fit points`;

// ---------- the interested-but-unconvinced group ----------

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

interface StudentRanking {
  /** The student's best TOP_MODULES + 1 modules, so any one module can be left out and five remain. */
  leaders: { moduleId: string; fit: number }[];
  /**
   * Modules that count towards the student's top five: never ones they have completed (the student's own
   * catalogue leaves those out), and only ones the programme rules allow when rules are given.
   */
  available: ReadonlySet<string>;
}

/** Rankings depend only on the context, so each is computed once per context and student. */
const rankings = new WeakMap<InsightContext, Map<StudentProfile, StudentRanking>>();

function rankingFor(student: StudentProfile, ctx: InsightContext): StudentRanking {
  let byStudent = rankings.get(ctx);
  if (!byStudent) {
    byStudent = new Map();
    rankings.set(ctx, byStudent);
  }
  const cached = byStudent.get(student);
  if (cached) return cached;
  const { rules } = ctx;
  const completed = new Set(student.completedModuleIds);
  const candidates = ctx.modules.filter(
    (m) => !completed.has(m.id) && (!rules || checkModuleEligibility(m.id, student, ctx.modules, rules).length === 0),
  );
  const leaders = candidates
    .map((m) => ({ moduleId: m.id, fit: scoreModule(student, m, ctx.weights, ctx.homeTopics).fit }))
    // Highest fit first, then module id, as rankModules orders a student's recommendations.
    .sort((a, b) => b.fit - a.fit || compareIds(a.moduleId, b.moduleId))
    .slice(0, TOP_MODULES + 1);
  const ranking = { leaders, available: new Set(candidates.map((m) => m.id)) };
  byStudent.set(student, ranking);
  return ranking;
}

/** True when the module, scoring `fit` for this student, ranks among their top TOP_MODULES modules. */
function inTopModules(student: StudentProfile, module: Module, fit: number, ctx: InsightContext): boolean {
  const { leaders, available } = rankingFor(student, ctx);
  if (!available.has(module.id)) return false;
  const last = leaders.filter((leader) => leader.moduleId !== module.id)[TOP_MODULES - 1];
  return last === undefined || fit > last.fit || (fit === last.fit && compareIds(module.id, last.moduleId) < 0);
}

/**
 * Spec 9.3: re-score S_m under each candidate change and report Δ_δ, the mean fit uplift, with the impact
 * module leads care about: how many students would newly have the module in their top five, and how many
 * would reach STRONG_FIT. Returns the top MAX_COUNTERFACTUALS changes with positive uplift, or nothing when
 * |S_m| < MIN_COHORT.
 */
export function counterfactuals(module: Module, ctx: InsightContext): Counterfactual[] {
  const { weights, homeTopics } = ctx;
  const group = interestedButUnconvinced(module, ctx.cohort, weights, homeTopics);
  if (group.length < MIN_COHORT) return [];
  const before = fitsFor(module, group, weights, homeTopics);
  const baseline = mean(before);
  const wasTop = group.map((student, i) => inTopModules(student, module, before[i] ?? 0, ctx));
  return candidateChanges(module)
    .map((change) => ({ change, after: fitsFor(applyChange(module, change), group, weights, homeTopics) }))
    // The mean of per-student differences equals the difference of the means.
    .map(({ change, after }) => ({ change, after, uplift: mean(after) - baseline }))
    .filter(({ uplift }) => uplift > 0)
    .sort((a, b) => b.uplift - a.uplift || compareIds(describeChange(module, a.change), describeChange(module, b.change)))
    .slice(0, MAX_COUNTERFACTUALS)
    .map(({ change, after, uplift }) => ({
      change,
      description: describeChange(module, change),
      uplift,
      groupSize: group.length,
      newlyTopModules: group.filter((student, i) => !wasTop[i] && inTopModules(student, module, after[i] ?? 0, ctx)).length,
      alreadyTopModules: wasTop.filter(Boolean).length,
      crossStrongFit: before.filter((fit, i) => fit < STRONG_FIT && (after[i] ?? 0) >= STRONG_FIT).length,
    }));
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

// ---------- the main gap, named when no single change is worth a card ----------

export interface Gap {
  /** For a headline, for example "the maths load". */
  short: string;
  /** For the detail, for example "the maths is above what these students are comfortable with". */
  long: string;
}

/** Each gap is read after "Compared with the modules these students rank higher, the main gap is …". */
const COMPONENT_GAPS: Record<'interest' | 'goal' | 'breadth', Gap> = {
  interest: { short: 'topic match', long: 'those modules cover more of the topics they want to study' },
  goal: { short: 'career relevance', long: 'those modules do more for the career pathways they chose' },
  breadth: { short: 'breadth', long: 'those modules take them further beyond their home programme' },
};

/** Style gaps, as [this module has more of it than the students want, this module has less]. */
const STYLE_GAPS: Record<StyleSlot, readonly [Gap, Gap]> = {
  examPreference: [
    { short: 'the exam-heavy assessment', long: 'more of the marks here come from the exam than they prefer' },
    { short: 'the coursework-heavy assessment', long: 'they would rather more of the marks came from the exam' },
  ],
  groupPreference: [
    { short: 'the amount of group work', long: 'there is more group work here than they prefer' },
    { short: 'too little group work', long: 'they would like more group work' },
  ],
  appliedPreference: [
    { short: 'the applied focus', long: 'the content is more applied than they prefer' },
    { short: 'the theory-heavy content', long: 'they want more applied, hands-on work' },
  ],
  mathsComfort: [
    { short: 'the maths load', long: 'the maths here is further above their comfort' },
    { short: 'the maths load', long: 'the maths here is further above their comfort' },
  ],
  codingComfort: [
    { short: 'the coding load', long: 'the coding here is further above their comfort' },
    { short: 'the coding load', long: 'the coding here is further above their comfort' },
  ],
  workloadTolerance: [
    { short: 'the workload', long: 'the workload here is further above what they want' },
    { short: 'the workload', long: 'the workload here is further above what they want' },
  ],
};

type Component = 'interest' | 'goal' | 'style' | 'breadth';
const COMPONENTS: readonly Component[] = ['interest', 'goal', 'style', 'breadth'];

/** Fit points each component contributes for one student (the terms of combineFit). */
function contributions(sub: ReturnType<typeof scoreModule>['sub'], weights: Weights): Record<Component, number> {
  const goalWeight = sub.goal === null ? 0 : weights.goal;
  const total = weights.interest + goalWeight + weights.style + weights.breadth;
  const points = (weight: number, value: number) => (total > 0 ? (100 * weight * value) / total : 0);
  return {
    interest: points(weights.interest, sub.interest),
    goal: points(goalWeight, sub.goal ?? 0),
    style: points(weights.style, sub.style),
    breadth: points(weights.breadth, sub.breadth),
  };
}

/** The modules a student ranks above this one: their top TOP_MODULES, leaving this module out. */
function rivalsFor(student: StudentProfile, module: Module, ctx: InsightContext): Module[] {
  return rankingFor(student, ctx)
    .leaders.filter((leader) => leader.moduleId !== module.id)
    .slice(0, TOP_MODULES)
    .flatMap((leader) => ctx.modules.filter((m) => m.id === leader.moduleId));
}

/**
 * Fit points one unit of penalty on one style question costs this student: styleFit averages penalties over
 * the K questions they answered, and combineFit weighs style against the components that apply to them.
 */
function pointsPerStylePenalty(student: StudentProfile, weights: Weights): number {
  const answered = STYLE_SLOTS.filter((slot) => student.style[slot] !== null).length;
  // goalAlignment is null, and its weight drops out, when the student has chosen no pathway.
  const goalWeight = student.pathways.length > 0 ? weights.goal : 0;
  const total = weights.interest + goalWeight + weights.style + weights.breadth;
  return answered === 0 || total <= 0 ? 0 : (100 * weights.style) / total / answered;
}

/** The style dimension where this module falls furthest behind the group's higher-ranked modules, in fit points. */
function styleGap(module: Module, group: readonly StudentProfile[], ctx: InsightContext): Gap {
  const scored = STYLE_SLOTS.map((slot) => {
    const field = DEMAND_FIELD[slot];
    const penalty = (moduleValue: number, value: number) =>
      CAPABILITY_SLOTS.has(slot) ? Math.max(0, moduleValue - value) : Math.abs(value - moduleValue);
    let cost = 0;
    let signed = 0;
    for (const student of group) {
      const value = student.style[slot];
      if (value === null) continue;
      const rivals = rivalsFor(student, module, ctx);
      const rivalPenalty = mean(rivals.map((rival) => penalty(rival.demand[field], value)));
      cost += pointsPerStylePenalty(student, ctx.weights) * (penalty(module.demand[field], value) - rivalPenalty);
      signed += module.demand[field] - value;
    }
    return { slot, cost, moduleHasMore: signed >= 0 };
  });
  const worst = scored.reduce((best, entry) => (entry.cost > best.cost ? entry : best));
  return STYLE_GAPS[worst.slot][worst.moduleHasMore ? 0 : 1];
}

/**
 * The fit component where the module falls furthest behind the modules the group ranks higher (each
 * student's top five), in fit points averaged across the group. Ties go to the earlier of interest, goal,
 * style and breadth.
 */
export function mainGap(module: Module, group: readonly StudentProfile[], ctx: InsightContext): Gap {
  const { weights, homeTopics } = ctx;
  const deficits: Record<Component, number> = { interest: 0, goal: 0, style: 0, breadth: 0 };
  for (const student of group) {
    const own = contributions(scoreModule(student, module, weights, homeTopics).sub, weights);
    const rivals = rivalsFor(student, module, ctx).map((rival) =>
      contributions(scoreModule(student, rival, weights, homeTopics).sub, weights),
    );
    for (const component of COMPONENTS)
      deficits[component] += mean(rivals.map((rival) => rival[component])) - own[component];
  }
  const component = COMPONENTS.reduce((best, next) => (deficits[next] > deficits[best] ? next : best));
  return component === 'style' ? styleGap(module, group, ctx) : COMPONENT_GAPS[component];
}

// ---------- cards ----------

/** Over capacity, with enough shortlists behind it for a DEMAND card (spec 20.4). */
function isOversubscribed(module: Module, ctx: InsightContext): boolean {
  const shortlisted = countShortlisted(module.id, ctx.shortlists);
  return module.capacity !== null && shortlisted > module.capacity && shortlisted >= MIN_COHORT;
}

/** The change as the tag editor would make it: the field and the value it ends up at. */
export function suggestedEditFor(module: Module, change: ModuleChange): SuggestedEdit {
  switch (change.kind) {
    case 'add-topic':
      return { group: 'topics', key: change.topic, value: change.weight };
    case 'shift-demand':
      return { group: 'demand', key: change.field, value: clamp01(module.demand[change.field] + change.delta) };
  }
}

/** One card per change worth acting on. Its id carries the change, so a decision stays with that change. */
function counterfactualCard(module: Module, ctx: InsightContext, counterfactual: Counterfactual): Insight {
  const { groupSize: size, newlyTopModules: newly, alreadyTopModules: already, crossStrongFit: crossing } = counterfactual;
  const points = counterfactual.uplift.toFixed(1);
  const top = ctx.rules ? `${TOP_MODULES_WORDS} eligible modules` : `${TOP_MODULES_WORDS} modules`;
  const topSentence = `${newly > 0 ? `${newly} more of them` : 'none of them'} would newly have it in their ${top}${already > 0 ? ` (${already} already do)` : ''}`;
  const crossSentence = crossing > 0 ? `${crossing} would rise to fit ${STRONG_FIT} or more` : `none would rise to fit ${STRONG_FIT}`;
  const impact =
    newly > 0 && crossing > 0
      ? `${TOP_MODULES_WORDS} for ${newly} of the ${size} interested students, and ${crossing} would reach fit ${STRONG_FIT}`
      : newly > 0
        ? `would move the module into the ${TOP_MODULES_WORDS} for ${newly} of the ${size} interested students`
        : crossing > 0
          ? `${crossing} of the ${size} interested students would reach fit ${STRONG_FIT}`
          : `+${points} fit points on average for ${size} interested students`;
  return {
    id: counterfactualInsightId(module.id, suggestedEditFor(module, counterfactual.change)),
    moduleId: module.id,
    kind: 'COUNTERFACTUAL',
    headline: `${counterfactual.description}: ${impact}`,
    detail: `${size} students are interested in the topics of ${moduleName(module)}, but its fit for them is below ${CONVINCED_FIT}. With this change their average fit rises by ${points} points: ${topSentence}, and ${crossSentence}.`,
    cohortSize: size,
    upliftPoints: roundTo(counterfactual.uplift, 1),
    decision: 'pending',
  };
}

/** One card in place of changes too small to act on, naming the gap that holds the module back. */
function summaryCard(module: Module, ctx: InsightContext, tested: readonly Counterfactual[]): Insight | null {
  const group = interestedButUnconvinced(module, ctx.cohort, ctx.weights, ctx.homeTopics);
  if (group.length < MIN_COHORT) return null;
  const gap = mainGap(module, group, ctx);
  const [best] = tested;
  const bestSentence = best
    ? `The best single change tested, to ${lowerFirst(best.description)}, adds ${pointsInWords(best.uplift)} on average.`
    : 'None of the changes tested raises their fit.';
  return {
    id: insightId(module.id, 'COUNTERFACTUAL', 'summary'),
    moduleId: module.id,
    kind: 'COUNTERFACTUAL',
    headline: `No single change makes a big difference; the main gap is ${gap.short}`,
    detail: `${group.length} students are interested in the topics of ${moduleName(module)}, but its fit for them is below ${CONVINCED_FIT}. No tested change adds ${MEANINGFUL_UPLIFT} or more fit points on average. ${bestSentence} Compared with the modules these students rank higher, the main gap is ${gap.short}: ${gap.long}.`,
    cohortSize: group.length,
    upliftPoints: null,
    decision: 'pending',
  };
}

/**
 * Spec 9.3 counterfactual cards: one per change worth at least MEANINGFUL_UPLIFT points, otherwise a single
 * summary card. An oversubscribed module gets none, since raising its fit would only add to the pressure;
 * its DEMAND card suggests how to manage demand instead.
 */
export function counterfactualInsights(module: Module, ctx: InsightContext): Insight[] {
  if (isOversubscribed(module, ctx)) return [];
  const tested = counterfactuals(module, ctx);
  const meaningful = tested.filter((counterfactual) => counterfactual.uplift >= MEANINGFUL_UPLIFT);
  if (meaningful.length > 0) return meaningful.map((counterfactual) => counterfactualCard(module, ctx, counterfactual));
  const summary = summaryCard(module, ctx, tested);
  return summary ? [summary] : [];
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
 * Modules of the same type with places left, ranked by average fit for the students who shortlisted this
 * one. Each average needs at least MIN_COHORT of those students who may take the module.
 */
export function alternatives(module: Module, ctx: InsightContext): { module: Module; averageFit: number }[] {
  const takers = ctx.cohort.filter((_, i) => ctx.shortlists[i]?.includes(module.id));
  return ctx.modules
    .filter((m) => m.id !== module.id && m.type === module.type)
    .filter((m) => m.capacity === null || countShortlisted(m.id, ctx.shortlists) < m.capacity)
    .flatMap((m) => {
      const able = takers.filter((student) => rankingFor(student, ctx).available.has(m.id));
      return able.length < MIN_COHORT ? [] : [{ module: m, averageFit: Math.round(mean(fitsFor(m, able, ctx.weights, ctx.homeTopics))) }];
    })
    .sort((a, b) => b.averageFit - a.averageFit || compareIds(a.module.id, b.module.id))
    .slice(0, MAX_ALTERNATIVES);
}

/** "A (average fit 68 for these students) and B (61)". */
function alternativesInWords(found: readonly { module: Module; averageFit: number }[]): string {
  const [first, ...rest] = found;
  if (!first) return '';
  const head = `${moduleName(first.module)} (average fit ${first.averageFit} for these students)`;
  return [head, ...rest.map((alt) => `${moduleName(alt.module)} (${alt.averageFit})`)].join(' and ');
}

/**
 * Spec 9.3 DEMAND: projected demand (cohort shortlists) against capacity, raised once shortlists reach
 * HIGH_DEMAND_CAPACITY_SHARE of the places. Needs at least MIN_COHORT shortlisting students. Over capacity,
 * the card is about managing demand, with modules that suit the same students and still have places.
 */
export function demand(module: Module, ctx: InsightContext): Insight | null {
  if (module.capacity === null) return null;
  const shortlisted = countShortlisted(module.id, ctx.shortlists);
  const capacityShare = shortlisted / module.capacity;
  if (shortlisted < MIN_COHORT || capacityShare < HIGH_DEMAND_CAPACITY_SHARE) return null;
  const percent = Math.round(100 * capacityShare);
  const base = `${shortlisted} students have shortlisted ${moduleName(module)}, which has ${module.capacity} places. Projected demand is ${percent}% of capacity.`;
  if (!isOversubscribed(module, ctx))
    return {
      id: insightId(module.id, 'DEMAND', 1),
      moduleId: module.id,
      kind: 'DEMAND',
      headline: `Near capacity: ${shortlisted} shortlists for ${module.capacity} places (${percent}%)`,
      detail: base,
      cohortSize: shortlisted,
      upliftPoints: null,
      decision: 'pending',
    };
  const others = alternativesInWords(alternatives(module, ctx));
  const pointTo = others
    ? `point students to the best-fitting modules that still have places, such as ${others}`
    : 'point students to similar modules that still have places';
  return {
    id: insightId(module.id, 'DEMAND', 1),
    moduleId: module.id,
    kind: 'DEMAND',
    headline: `Oversubscribed: ${shortlisted} shortlists for ${module.capacity} places (${percent}%). Manage demand rather than raise fit`,
    detail: `${base} Raising its fit would only add to the pressure, so no fit changes are suggested. To manage demand: add places or a second group, publish clear selection criteria, or ${pointTo}.`,
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

/**
 * Every insight card for one module, each awaiting a staff decision (spec 10.7). Cards most worth a module
 * lead's time come first: changes that would raise fit, then demand (including what to do when a module is
 * full), then overlooked, then timetable clashes, and the summary card last, since it says no single change
 * is worth making.
 */
export function buildInsights(module: Module, ctx: InsightContext): Insight[] {
  const counterfactualCards = counterfactualInsights(module, ctx);
  return [
    ...counterfactualCards.filter((insight) => !isCounterfactualSummary(insight)),
    ...[demand(module, ctx), overlooked(module, ctx)].filter((insight) => insight !== null),
    ...clashInsights(module, ctx),
    ...counterfactualCards.filter(isCounterfactualSummary),
  ];
}

const isCounterfactualSummary = (insight: Insight): boolean =>
  insight.kind === 'COUNTERFACTUAL' && insight.upliftPoints === null;

/** Ids counterfactual cards had before they carried their change: `<module>:COUNTERFACTUAL:<rank>`. */
const RANKED_COUNTERFACTUAL_ID = /:COUNTERFACTUAL:(\d+)$/;

/** The change a card describes: its engine headline up to the impact, for example "Move 20% of the marks …". */
const changeWording = (card: Insight): string => card.headline.slice(0, card.headline.indexOf(': ') + 1);

export interface StoredDecisions {
  /** The staff decision for each current card id. */
  decisions: Map<string, InsightDecision>;
  /** Old rank-based rows whose decision has now moved to a change-based id: the caller deletes them. */
  consumedIds: string[];
}

/**
 * The staff decision for each card, by id. Counterfactual cards used to be numbered by rank (`…:1`), so a
 * decision recorded under such an id is converted once, to the change-based id of the same change:
 * - first by the change itself: the old headline starts with the card's engine wording, with the same uplift;
 * - otherwise, for an old headline the Insights agent reworded (it matches no current card's wording), by
 *   the same rank among the change cards and the same uplift.
 * Each old row moves at most once and is then handed back for deletion, so it can never mark a later card.
 * Rows that match nothing are kept, still hidden, until they can be matched. A decision already stored under
 * the new id always wins. `cards` must be the engine's own output, before the Insights agent rewords it.
 */
export function storedDecisions(cards: readonly Insight[], stored: readonly Insight[]): StoredDecisions {
  const decisions = new Map(stored.map((insight) => [insight.id, insight.decision]));
  const changeCards = cards.filter((card) => card.kind === 'COUNTERFACTUAL' && !isCounterfactualSummary(card));
  const wordings = changeCards.map(changeWording).filter((wording) => wording !== '');
  const unused = stored.filter((insight) => RANKED_COUNTERFACTUAL_ID.test(insight.id) && insight.decision !== 'pending');
  const consumedIds: string[] = [];
  const take = (cardId: string, index: number) => {
    const [old] = unused.splice(index, 1);
    if (!old) return;
    decisions.set(cardId, old.decision);
    consumedIds.push(old.id);
  };
  const open = changeCards.filter((card) => !decisions.has(card.id));
  // By the change itself.
  for (const card of open) {
    const wording = changeWording(card);
    const match = unused.findIndex((old) => wording !== '' && old.headline.startsWith(wording) && old.upliftPoints === card.upliftPoints);
    if (match >= 0) take(card.id, match);
  }
  // Reworded rows only: same rank and same uplift.
  for (const card of open) {
    if (decisions.has(card.id)) continue;
    const rank = String(changeCards.indexOf(card) + 1);
    const match = unused.findIndex(
      (old) =>
        RANKED_COUNTERFACTUAL_ID.exec(old.id)?.[1] === rank &&
        old.upliftPoints === card.upliftPoints &&
        !wordings.some((wording) => old.headline.startsWith(wording)),
    );
    if (match >= 0) take(card.id, match);
  }
  return { decisions, consumedIds };
}
