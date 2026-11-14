// Module Analyst output contract and the deterministic checks from spec 10.4, shared by
// scripts/analyse-modules.ts and the data tests so both apply exactly the same rules.
import { type ModuleDerived, SKILL_IDS, schemas as S, TOPIC_IDS } from '@modulematch/shared';
import { z } from 'zod';
import type { RawModule } from '../../server/src/db/datasets.ts';

/** A topic weight at or above this needs a verbatim quote from the description. */
export const QUOTE_REQUIRED_WEIGHT = 0.5;
/** Weight given to a topic whose quote is missing or not found verbatim. */
export const UNQUOTED_WEIGHT_CAP = 0.45;
/** Descriptions shorter than this are flagged for staff review. */
export const MIN_DESCRIPTION_WORDS = 60;
/** Prefix on the rationale of every module flagged for staff review. */
export const REVIEW_PREFIX = 'REVIEW:';

/** The `_note` written at the top of data/modules.json. */
export const MODULES_NOTE =
  'Sample of public module descriptions (see modules.raw.json for sources and assumptions), not an official ' +
  'catalogue. topics, skills, pathwayRelevance and demand were derived by the Module Analyst agent and are ' +
  `editable by staff; rationales starting with ${REVIEW_PREFIX} flag descriptions under ${MIN_DESCRIPTION_WORDS} words.`;

const isUnique = (keys: string[]) => new Set(keys).size === keys.length;

/** The structured output the analyst model must return through its tool call, for the given pathway ids. */
export function analystOutputSchema(pathwayIds: [string, ...string[]]) {
  return z.object({
    topics: z
      .array(
        z.object({
          topic: z.enum(TOPIC_IDS),
          weight: S.Fraction,
          quote: z.string().describe('Verbatim phrase from the description; required when weight >= 0.5, else empty.'),
        }),
      )
      .min(1)
      .refine((entries) => isUnique(entries.map((t) => t.topic)), 'Each topic may appear only once'),
    skills: z
      .array(z.object({ skill: z.enum(SKILL_IDS), weight: S.Fraction }))
      .min(1)
      .refine((entries) => isUnique(entries.map((s) => s.skill)), 'Each skill may appear only once'),
    pathwayRelevance: z
      .array(z.object({ pathway: z.enum(pathwayIds), weight: S.Fraction }))
      .length(pathwayIds.length)
      .refine((entries) => isUnique(entries.map((p) => p.pathway)), 'Every pathway must appear exactly once'),
    demand: S.ModuleDemand,
    summary: z.string().min(1).describe('One or two sentences on what the module covers. Assessment is added from the published data.'),
  });
}

export type AnalystOutput = z.infer<ReturnType<typeof analystOutputSchema>>;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** One `<topic> <weight> "<quote>"` evidence entry as it appears in a rationale. */
function formatEvidence(topic: string, weight: number, quote: string): string {
  return `${topic} ${weight.toFixed(2)} "${quote}"`;
}

const EVIDENCE_PATTERN = /([a-z-]+) (\d\.\d\d) "([^"]+)"/g;

/** Topic to quoted phrase, read back from a rationale written by applyAnalystChecks. */
export function quotedTopics(rationale: string): Map<string, string> {
  return new Map([...rationale.matchAll(EVIDENCE_PATTERN)].map((m) => [m[1] ?? '', m[3] ?? '']));
}

/**
 * Turn the model's output into ModuleDerived, enforcing spec 10.4: taxonomy keys only (the schema rejects
 * any other key), every topic weight of 0.5 or more quotes a phrase found verbatim in the description
 * (otherwise it is capped at 0.45 and the cap is noted), and short descriptions are flagged for review.
 */
const mean = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

/** Weights below this after averaging are noise from a single sample and are dropped. */
const MIN_AVERAGED_WEIGHT = 0.05;

/**
 * Self-consistency: averages several analyst samples for one module, so tags do not swing between runs (current
 * models take no temperature setting). A topic or skill missing from a sample counts as 0 there. A topic's quote is
 * the first non-empty one any sample gave (applyAnalystChecks still verifies it), and the summary is the first sample's.
 */
export function averageSamples(samples: [AnalystOutput, ...AnalystOutput[]]): AnalystOutput {
  const averaged = <K extends string>(keys: K[], weightOf: (sample: AnalystOutput, key: K) => number | undefined) =>
    keys
      .map((key) => ({ key, weight: mean(samples.map((sample) => weightOf(sample, key) ?? 0)) }))
      .filter((entry) => entry.weight >= MIN_AVERAGED_WEIGHT);
  const topicIds = [...new Set(samples.flatMap((sample) => sample.topics.map((t) => t.topic)))];
  const skillIds = [...new Set(samples.flatMap((sample) => sample.skills.map((t) => t.skill)))];
  const first = samples[0];
  return {
    topics: averaged(topicIds, (sample, topic) => sample.topics.find((t) => t.topic === topic)?.weight).map(({ key, weight }) => ({
      topic: key,
      weight,
      quote: samples.flatMap((sample) => sample.topics.filter((t) => t.topic === key && t.quote.trim())).map((t) => t.quote)[0] ?? '',
    })),
    skills: averaged(skillIds, (sample, skill) => sample.skills.find((t) => t.skill === skill)?.weight).map(({ key, weight }) => ({ skill: key, weight })),
    pathwayRelevance: first.pathwayRelevance.map(({ pathway }) => ({
      pathway,
      weight: mean(samples.map((sample) => sample.pathwayRelevance.find((p) => p.pathway === pathway)?.weight ?? 0)),
    })),
    demand: Object.fromEntries(
      (Object.keys(first.demand) as (keyof AnalystOutput['demand'])[]).map((field) => [field, mean(samples.map((sample) => sample.demand[field]))]),
    ) as AnalystOutput['demand'],
    summary: first.summary,
  };
}

/** The published assessment in words, with exact percentages (37.5%, never 38%). */
export function publishedAssessmentText(assessment: RawModule['assessment']): string | null {
  if (assessment.length === 0) return null;
  return `Published assessment: ${assessment.map((a) => `${a.description} (${+(a.weighting * 100).toFixed(1)}%, ${a.type})`).join(', ')}.`;
}

/** Assessment items that are group work, judged from the published description. */
const GROUP_WORK = /\b(group|team)\b/i;

/**
 * Exam and group shares are published facts, so code sets them from the published assessment rather than taking the
 * model's estimate (which can round, for example 37.5% to 0.38). Without published assessment the estimate stands.
 */
export function alignWithPublishedAssessment(
  demand: AnalystOutput['demand'],
  assessment: RawModule['assessment'],
): AnalystOutput['demand'] {
  if (assessment.length === 0) return demand;
  const share = (keep: (a: RawModule['assessment'][number]) => boolean) =>
    Math.round(assessment.filter(keep).reduce((sum, a) => sum + a.weighting, 0) * 1000) / 1000;
  return {
    ...demand,
    examShare: share((a) => a.type === 'examination'),
    groupShare: share((a) => GROUP_WORK.test(a.description)),
  };
}

export function applyAnalystChecks(module: Pick<RawModule, 'description' | 'assessment'>, output: AnalystOutput): ModuleDerived {
  const topics: Record<string, number> = {};
  const evidence: string[] = [];
  const capped: string[] = [];
  for (const { topic, weight, quote } of output.topics) {
    const supported = quote.trim().length > 0 && module.description.includes(quote);
    if (weight >= QUOTE_REQUIRED_WEIGHT && !supported) {
      topics[topic] = UNQUOTED_WEIGHT_CAP;
      capped.push(topic);
    } else {
      topics[topic] = weight;
      if (weight >= QUOTE_REQUIRED_WEIGHT) evidence.push(formatEvidence(topic, weight, quote));
    }
  }

  const words = wordCount(module.description);
  const parts = [
    words < MIN_DESCRIPTION_WORDS
      ? `${REVIEW_PREFIX} description is ${words} words (under ${MIN_DESCRIPTION_WORDS}), so staff should check these tags.`
      : null,
    output.summary.trim(),
    publishedAssessmentText(module.assessment),
    evidence.length > 0 ? `Evidence: ${evidence.join('; ')}.` : 'Evidence: no topic reaches 0.5.',
    capped.length > 0
      ? `Capped at ${UNQUOTED_WEIGHT_CAP} for lack of a verbatim quote: ${capped.join(', ')}.`
      : null,
  ];

  return S.ModuleDerived.parse({
    topics,
    skills: Object.fromEntries(output.skills.map((s) => [s.skill, s.weight])),
    pathwayRelevance: Object.fromEntries(output.pathwayRelevance.map((p) => [p.pathway, p.weight])),
    demand: alignWithPublishedAssessment(output.demand, module.assessment),
    derivedBy: 'analyst-agent',
    derivedRationale: parts.filter((p): p is string => p !== null).join(' '),
  });
}
