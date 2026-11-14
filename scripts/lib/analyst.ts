// Module Analyst output contract and the deterministic checks from spec 10.4, shared by
// scripts/analyse-modules.ts and the data tests so both apply exactly the same rules.
import { type ModuleDerived, SKILL_IDS, schemas as S, TOPIC_IDS } from '@modulematch/shared';
import { z } from 'zod';
import type { RawModule } from '../../api/src/db/datasets.ts';

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
    summary: z.string().min(1).describe('One or two sentences on what the module is and how it is assessed.'),
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
export function applyAnalystChecks(module: Pick<RawModule, 'description'>, output: AnalystOutput): ModuleDerived {
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
    evidence.length > 0 ? `Evidence: ${evidence.join('; ')}.` : 'Evidence: no topic reaches 0.5.',
    capped.length > 0
      ? `Capped at ${UNQUOTED_WEIGHT_CAP} for lack of a verbatim quote: ${capped.join(', ')}.`
      : null,
  ];

  return S.ModuleDerived.parse({
    topics,
    skills: Object.fromEntries(output.skills.map((s) => [s.skill, s.weight])),
    pathwayRelevance: Object.fromEntries(output.pathwayRelevance.map((p) => [p.pathway, p.weight])),
    demand: output.demand,
    derivedBy: 'analyst-agent',
    derivedRationale: parts.filter((p): p is string => p !== null).join(' '),
  });
}
