import taxonomyJson from '../../../data/taxonomy.json' with { type: 'json' };
import { slotValueSchema } from './schemas.ts';
import type { Confidence, Weights } from './types.ts';

/** Spec 8.5 default weights. The what-if sliders change these four numbers and nothing else. */
export const DEFAULT_WEIGHTS: Weights = { interest: 0.45, goal: 0.25, style: 0.2, breadth: 0.1 };

/** Spec 8.6 confidence thresholds on profile completeness. */
export const CONFIDENCE_THRESHOLDS = { high: 0.8, medium: 0.5 } as const;

export function confidenceLabel(completeness: number): Confidence {
  if (completeness >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (completeness >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/** Spec 8.6: at least this many interest topics must have evidence for the interest slot to count. */
export const MIN_INTEREST_TOPICS = 3;

/** Spec 9.2 clash labels. */
export const LIKELY_CLASH_THRESHOLD = 0.3;
/** Spec 9.2 swap tolerance in fit points. */
export const SWAP_FIT_TOLERANCE = 10;
/** Spec 9.3 / 20.4 minimum cohort behind any staff insight. */
export const MIN_COHORT = 5;
/** Spec 10.1 intent confidence floor before the Supervisor asks a clarifying question. */
export const INTENT_CONFIDENCE_FLOOR = 0.6;
/** Spec 10.2 quick and deep interview question budgets. */
export const INTERVIEW_BUDGET = { quick: 8, deep: 30 } as const;
/** Questions offered when a student who skipped the interview comes back to it (spec 8.6 low confidence). */
export const STARTER_QUESTIONS = 3;

export const taxonomy = taxonomyJson;
export type TaxonomyTopicKey = keyof typeof taxonomyJson.topics;
export type TaxonomySkillKey = keyof typeof taxonomyJson.skills;
export const TOPIC_IDS = Object.keys(taxonomyJson.topics) as TaxonomyTopicKey[];
export const SKILL_IDS = Object.keys(taxonomyJson.skills) as TaxonomySkillKey[];

/** Style slot names on StudentProfile.style, in spec 8.3 order. */
export const STYLE_SLOTS = [
  'examPreference',
  'groupPreference',
  'appliedPreference',
  'mathsComfort',
  'codingComfort',
  'workloadTolerance',
] as const;

/**
 * Whitelisted slot names the Profile Extractor may write (spec 10.3).
 * Interest slots are written as `interest:<topicId>`; everything else is listed here.
 */
export const PROFILE_SLOTS = [
  ...STYLE_SLOTS.map((s) => `style.${s}` as const),
  'breadthAppetite',
  'pathways',
  'pathwaysSkipped',
  'timetablePrefs.avoidDays',
  'timetablePrefs.earliestStart',
] as const;

export function isAllowedSlot(slot: string): boolean {
  return slotValueSchema(slot) !== null;
}

export const MODE_LABELS = {
  ONBOARD: 'Getting started',
  INTERVIEW: 'Interview',
  RECOMMEND: 'Recommendations',
  EXPLAIN: 'Explaining',
  PLAN: 'Planning timetable',
  ESCALATED: 'With a tutor',
} as const;

/** Length limits on answer feedback, defined beside the Feedback schemas and re-exported here for the web app. */
export { FEEDBACK_COMMENT_MAX, FEEDBACK_EXCERPT_MAX, FEEDBACK_QUESTION_MAX } from './schemas.ts';

/** Results upload size limits (spec 23), defined beside ResultsUploadBody and re-exported for the server and web app. */
export { RESULTS_BASE64_MAX, RESULTS_BODY_MAX_BYTES, RESULTS_FILE_MAX_BYTES } from './schemas.ts';
