// Issue #105: one fit scale for the whole app. The server's explanation names the same band the student sees
// beside the score, and never lists a reason for a topic the student did not mention.
import { DEFAULT_WEIGHTS, FIT_BAND_FLOORS, FIT_BAND_LABELS, fitBand, type Recommendation } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { explain, explainByRules } from '../src/agents/matcher.ts';
import { rankModules } from '../src/engines/index.ts';
import { STRONG_FIT } from '../src/engines/insights.ts';
import { createTracer } from '../src/trace/tracer.ts';
import { makeModule, makeProfile, makeRules } from './engines-fixtures.ts';

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

  it('the served explanation drops a topic reason the student never gave, and says so in the trace', async () => {
    const events: { actor: string; output: string }[] = [];
    const explanation = await explain(profile, nuclear, rec, [], createTracer('s', (e) => events.push(e)));
    expect(explanation.because.some((b) => b.moduleField?.startsWith('topics.'))).toBe(false);
    expect(events.find((e) => e.actor === 'G6 grounding')?.output).toMatch(/no reasons/);
  });
});
