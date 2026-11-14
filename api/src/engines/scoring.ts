// Spec 8: the deterministic scoring engine. Pure functions with no model calls: same inputs, same outputs.
import { combineFit, confidenceLabel, isAllowedSlot, MIN_INTEREST_TOPICS, schemas, STYLE_SLOTS } from '@modulematch/shared';
import type {
  Evidence,
  Module,
  ModuleDemand,
  PathwayId,
  ProgrammeRules,
  Recommendation,
  StudentProfile,
  Style,
  TopicId,
  Weights,
} from '@modulematch/shared';
import { checkModuleEligibility } from './rules.ts';
import { clamp01, compareIds, mean } from './util.ts';

export type TopicWeights = Record<TopicId, number>;
type StyleSlot = (typeof STYLE_SLOTS)[number];

/** The module demand field each style dimension is compared against (spec 8.3). */
const DEMAND_FIELD: Record<StyleSlot, keyof ModuleDemand> = {
  examPreference: 'examShare',
  groupPreference: 'groupShare',
  appliedPreference: 'applied',
  mathsComfort: 'mathsIntensity',
  codingComfort: 'codingIntensity',
  workloadTolerance: 'workload',
};

/** Capability dimensions are penalised only when the module demands more than the student offers (spec 8.3). */
const CAPABILITY_SLOTS: ReadonlySet<StyleSlot> = new Set(schemas.CapabilityDimensions);

/**
 * Style fit when the student has no style values yet (K = 0 in spec 8.3). Every module gets the same
 * neutral value, so an empty style profile never changes the ranking.
 */
export const NEUTRAL_STYLE_FIT = 0.5;

const INTEREST_SLOT_PREFIX = 'interest:';

/**
 * The ratio Σ_j v_j t_j / Σ_j t_j over a module's topic weights t, shared by spec 8.1 and 8.4.
 * Returns null when the topics carry no weight, so callers never divide by zero.
 */
export function topicWeightedShare(values: TopicWeights, topics: TopicWeights): number | null {
  let weighted = 0;
  let total = 0;
  for (const [topic, weight] of Object.entries(topics)) {
    weighted += (values[topic] ?? 0) * weight;
    total += weight;
  }
  return total > 0 ? clamp01(weighted / total) : null;
}

/** Spec 8.1: I(s,m), how much of the content the student cares about. 0 for content with no topics. */
export function interestAlignment(interests: TopicWeights, topics: TopicWeights): number {
  return topicWeightedShare(interests, topics) ?? 0;
}

/** Spec 8.2: G(s,m) = max over the chosen pathways of the module's relevance; null when none are chosen. */
export function goalAlignment(pathways: readonly PathwayId[], relevance: Record<PathwayId, number>): number | null {
  if (pathways.length === 0) return null;
  return clamp01(Math.max(...pathways.map((pathway) => relevance[pathway] ?? 0)));
}

/**
 * Spec 8.3: L(s,m) = 1 − (1/K) Σ δ_k. Preference dimensions use |a − d|, capability dimensions use
 * max(0, d − a). Null student values are skipped, shrinking K.
 */
export function styleFit(style: Style, demand: ModuleDemand): number {
  const penalties = STYLE_SLOTS.flatMap((slot) => {
    const studentValue = style[slot];
    if (studentValue === null) return [];
    const moduleValue = demand[DEMAND_FIELD[slot]];
    return [CAPABILITY_SLOTS.has(slot) ? Math.max(0, moduleValue - studentValue) : Math.abs(studentValue - moduleValue)];
  });
  return penalties.length === 0 ? NEUTRAL_STYLE_FIT : clamp01(1 - mean(penalties));
}

/**
 * Spec 8.4: B(s,m) = b_s (1 − home-programme share of the module's topics). An unknown appetite or a
 * module with no topics earns no breadth credit.
 */
export function breadth(breadthAppetite: number | null, homeTopics: TopicWeights, topics: TopicWeights): number {
  const homeShare = topicWeightedShare(homeTopics, topics);
  if (breadthAppetite === null || homeShare === null) return 0;
  return clamp01(breadthAppetite * (1 - homeShare));
}

/**
 * Spec 8.5: score one module for one student. Eligibility is left as true here; rankModules applies
 * the programme rules (spec 8.7).
 */
export function scoreModule(
  profile: StudentProfile,
  module: Module,
  weights: Weights,
  homeTopics: TopicWeights,
): Recommendation {
  const sub = {
    interest: interestAlignment(profile.interests, module.topics),
    goal: goalAlignment(profile.pathways, module.pathwayRelevance),
    style: styleFit(profile.style, module.demand),
    breadth: breadth(profile.breadthAppetite, homeTopics, module.topics),
  };
  return {
    moduleId: module.id,
    fit: combineFit(sub, weights),
    sub,
    eligible: true,
    ineligibleReasons: [],
    confidence: confidenceLabel(profile.completeness),
  };
}

/** Highest fit first, then module id, so equal fits always come out in the same order. */
const byFitThenId = (a: Recommendation, b: Recommendation): number =>
  b.fit - a.fit || compareIds(a.moduleId, b.moduleId);

/**
 * Spec 8.7: score every module and gate it through the rules engine. Ineligible modules stay in the
 * list with their reasons, so the catalogue can grey them out.
 */
export function rankModules(
  profile: StudentProfile,
  modules: readonly Module[],
  weights: Weights,
  rules: ProgrammeRules,
): Recommendation[] {
  return modules
    .map((module) => {
      const violations = checkModuleEligibility(module.id, profile, modules, rules);
      return {
        ...scoreModule(profile, module, weights, rules.homeTopics),
        eligible: violations.length === 0,
        ineligibleReasons: violations.map((violation) => violation.message),
      };
    })
    .sort(byFitThenId);
}

/**
 * Spec 8.6: the fraction of required slots with at least one evidence item. The nine required slots
 * are: interests (at least MIN_INTEREST_TOPICS distinct topics), each of the six style dimensions,
 * breadth appetite, and a pathway choice or an explicit skip.
 */
export function completeness(profile: StudentProfile, evidence: readonly Evidence[]): number {
  const slots = new Set(evidence.map((item) => item.slot).filter(isAllowedSlot));
  const interestTopics = [...slots].filter((slot) => slot.startsWith(INTEREST_SLOT_PREFIX)).length;
  const required = [
    interestTopics >= MIN_INTEREST_TOPICS,
    ...STYLE_SLOTS.map((slot) => slots.has(`style.${slot}`)),
    slots.has('breadthAppetite'),
    profile.pathwaysSkipped || slots.has('pathways') || slots.has('pathwaysSkipped'),
  ];
  return required.filter(Boolean).length / required.length;
}

/** JSON with object keys sorted at every level, so equal values always serialise identically. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => compareIds(a, b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 32-bit FNV-1a over UTF-16 code units, as 8 hex characters. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Cache key for explanations (spec 5: explanations are cached by profile hash and module id).
 * `updatedAt` is left out so re-saving an unchanged profile keeps its cached explanations.
 */
export function profileHash(profile: StudentProfile, weights: Weights): string {
  return fnv1a(stableStringify({ profile: { ...profile, updatedAt: undefined }, weights }));
}
