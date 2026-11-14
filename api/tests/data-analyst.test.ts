// WS1: the Module Analyst checks (spec 10.4), on fixed inputs and on every module in data/modules.json.
import { describe, expect, it } from 'vitest';
import {
  type AnalystOutput,
  analystOutputSchema,
  applyAnalystChecks,
  MIN_DESCRIPTION_WORDS,
  QUOTE_REQUIRED_WEIGHT,
  quotedTopics,
  REVIEW_PREFIX,
  UNQUOTED_WEIGHT_CAP,
  wordCount,
} from '../../scripts/lib/analyst.ts';
import { DATASET_FILES, ModulesFile, readDataset } from '../src/db/datasets.ts';

const demand = { examShare: 1, groupShare: 0, applied: 0.4, mathsIntensity: 0.7, codingIntensity: 0, workload: 0.5 };
const output = (topics: AnalystOutput['topics']): AnalystOutput => ({
  topics,
  skills: [{ skill: 'quantitative-analysis', weight: 0.6 }],
  pathwayRelevance: [{ pathway: 'research-academia', weight: 0.5 }],
  demand,
  summary: 'A test module.',
});
const longText = `${'Fluid statics and the dynamics of incompressible flow in pipes. '.repeat(8)}`;

describe('applyAnalystChecks', () => {
  it('keeps a high topic weight backed by a verbatim quote and records the evidence', () => {
    const d = applyAnalystChecks({ description: longText }, output([{ topic: 'fluid-mechanics', weight: 0.9, quote: 'incompressible flow in pipes' }]));
    expect(d.topics['fluid-mechanics']).toBe(0.9);
    expect(quotedTopics(d.derivedRationale).get('fluid-mechanics')).toBe('incompressible flow in pipes');
    expect(d.derivedBy).toBe('analyst-agent');
  });

  it('caps a high weight whose quote is missing or not in the description', () => {
    const d = applyAnalystChecks(
      { description: longText },
      output([
        { topic: 'fluid-mechanics', weight: 0.8, quote: 'turbulent jets' },
        { topic: 'mathematics-modelling', weight: 0.6, quote: '' },
        { topic: 'experimental-lab', weight: 0.3, quote: '' },
      ]),
    );
    expect(d.topics).toEqual({ 'fluid-mechanics': UNQUOTED_WEIGHT_CAP, 'mathematics-modelling': UNQUOTED_WEIGHT_CAP, 'experimental-lab': 0.3 });
    expect(d.derivedRationale).toContain('fluid-mechanics, mathematics-modelling');
  });

  it('flags descriptions under the word limit for staff review', () => {
    const d = applyAnalystChecks({ description: 'Short text about flow.' }, output([{ topic: 'fluid-mechanics', weight: 0.4, quote: '' }]));
    expect(d.derivedRationale.startsWith(REVIEW_PREFIX)).toBe(true);
    expect(applyAnalystChecks({ description: longText }, output([{ topic: 'fluid-mechanics', weight: 0.4, quote: '' }])).derivedRationale.startsWith(REVIEW_PREFIX)).toBe(false);
  });

  it('rejects keys outside the taxonomy and unknown pathways', () => {
    const schema = analystOutputSchema(['research-academia']);
    expect(schema.safeParse({ ...output([]), topics: [{ topic: 'astrology', weight: 0.5, quote: '' }] }).success).toBe(false);
    expect(schema.safeParse({ ...output([{ topic: 'fluid-mechanics', weight: 0.5, quote: '' }]), pathwayRelevance: [{ pathway: 'pirate', weight: 1 }] }).success).toBe(false);
  });
  it('requires every pathway exactly once and no repeated topics or skills', () => {
    const schema = analystOutputSchema(['research-academia', 'consulting']);
    const base = { ...output([{ topic: 'fluid-mechanics', weight: 0.4, quote: '' }]) };
    const both = [
      { pathway: 'research-academia', weight: 0.5 },
      { pathway: 'consulting', weight: 0.1 },
    ];
    expect(schema.safeParse({ ...base, pathwayRelevance: both }).success).toBe(true);
    expect(schema.safeParse(base).success).toBe(false);
    expect(schema.safeParse({ ...base, pathwayRelevance: [both[0], both[0]] }).success).toBe(false);
    expect(schema.safeParse({ ...base, pathwayRelevance: both, skills: [...base.skills, ...base.skills] }).success).toBe(false);
  });
});

describe('data/modules.json follows the analyst rules', () => {
  const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);

  it.each(modules.map((m) => [m.id, m] as const))('%s', (_id, m) => {
    const quotes = quotedTopics(m.derivedRationale);
    for (const [topic, weight] of Object.entries(m.topics)) {
      if (weight < QUOTE_REQUIRED_WEIGHT) continue;
      const quote = quotes.get(topic);
      expect(quote, `${topic} needs a quote`).toBeDefined();
      expect(m.description).toContain(quote);
    }
    const short = wordCount(m.description) < MIN_DESCRIPTION_WORDS;
    expect(m.derivedRationale.startsWith(REVIEW_PREFIX)).toBe(short);
  });
});
