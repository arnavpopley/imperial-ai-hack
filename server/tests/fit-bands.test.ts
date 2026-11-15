// Issue #105: one fit scale for the whole app. The server's explanation names the same band the student sees
// beside the score, and never lists a reason for a topic the student did not mention.
import { DEFAULT_WEIGHTS, FIT_BAND_FLOORS, FIT_BAND_LABELS, fitBand, type Recommendation } from '@modulematch/shared';
import { describe, expect, it, vi } from 'vitest';
import { explain, explainByRules } from '../src/agents/matcher.ts';
import { rankModules } from '../src/engines/index.ts';
import { STRONG_FIT } from '../src/engines/insights.ts';
import { createTracer } from '../src/trace/tracer.ts';
import { makeModule, makeProfile, makeRules } from './engines-fixtures.ts';

// The live Matcher, stubbed: it offers one reason for a topic the student never mentioned and one that matches
// a quote, so the test sees explain() drop the first and keep the second.
const live = vi.hoisted(() => ({ on: false }));
vi.mock('../src/agents/llm.ts', async (original) => ({
  ...(await original<typeof import('../src/agents/llm.ts')>()),
  isLive: () => live.on,
  structured: async () => ({
    summary: 'A weak fit at 13.',
    because: [
      { text: 'It is mainly about nuclear energy.', evidenceId: null, moduleField: 'topics.thermodynamics-energy' },
      { text: 'You said you like building robots.', evidenceId: 'ev-robots', moduleField: null },
    ],
    watchOuts: [],
  }),
}));

describe('the shared fit bands', () => {
  it('cut at 70, 50 and 35', () => {
    expect([100, 70, 69, 62, 50, 49, 35, 34, 0].map(fitBand)).toEqual(['strong', 'strong', 'good', 'good', 'good', 'partial', 'partial', 'weak', 'weak']);
    expect(FIT_BAND_LABELS[fitBand(62)]).toBe('Good fit');
  });

  it('are the scale the insights engine counts a strong fit on', () => {
    expect(STRONG_FIT).toBe(FIT_BAND_FLOORS.strong);
  });
});

describe('explanations use the shared band', () => {
  const rules = makeRules({ allowedElectiveIds: ['m'] });
  const withFit = (fit: number): Recommendation => ({ ...rankModules(makeProfile({ interests: { 'fluid-mechanics': 0.9 } }), [makeModule('m')], DEFAULT_WEIGHTS, rules)[0]!, fit });

  it.each([82, 62, 40, 13])('names the band of a fit of %i in the summary', (fit) => {
    const profile = makeProfile({ interests: { 'fluid-mechanics': 0.9 } });
    const summary = explainByRules(profile, makeModule('m'), withFit(fit), []).summary;
    expect(summary.startsWith(`A ${FIT_BAND_LABELS[fitBand(fit)].toLowerCase()} at ${fit}`)).toBe(true);
  });
});

describe('reasons are only real matches', () => {
  // The student likes robotics; the module is mainly nuclear energy, which they never mentioned.
  const profile = makeProfile({ interests: { 'control-robotics': 0.9 } });
  const nuclear = makeModule('m', { topics: { 'thermodynamics-energy': 0.9 } });
  const rec = rankModules(profile, [nuclear], DEFAULT_WEIGHTS, makeRules({ allowedElectiveIds: ['m'] }))[0]!;

  it('the template gives no reason for an unmentioned topic', () => {
    const explanation = explainByRules(profile, nuclear, rec, []);
    expect(explanation.because).toEqual([]);
    expect(explanation.watchOuts.join(' ')).toMatch(/Little of its content overlaps/);
  });

  it('a live explanation loses a topic reason the student never gave, and keeps one from their own words', async () => {
    live.on = true;
    try {
      const events: { actor: string; output: string; verdict: string | null }[] = [];
      const evidence = [{ id: 'ev-robots', sessionId: 's', turnId: 't', slot: 'interest:control-robotics', value: 0.9, quote: 'I like building robots', confidence: 0.9 }];
      const explanation = await explain(profile, nuclear, rec, evidence, createTracer('s', (e) => events.push(e)));
      expect(explanation.because.map((b) => b.text)).toEqual(['You said you like building robots.']);
      const g6 = events.find((e) => e.actor === 'G6 grounding');
      expect(g6?.output).toMatch(/1 unsupported reason/);
      expect(g6?.verdict).toBe('redact');
    } finally {
      live.on = false;
    }
  });

  it('with nothing matching, the served explanation has no reasons and the trace says why', async () => {
    const events: { actor: string; output: string }[] = [];
    const explanation = await explain(profile, nuclear, rec, [], createTracer('s', (e) => events.push(e)));
    expect(explanation.because).toEqual([]);
    expect(events.find((e) => e.actor === 'G6 grounding')?.output).toMatch(/no reasons/);
  });
});
