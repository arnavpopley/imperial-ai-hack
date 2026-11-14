// Spec 9.3: counterfactual uplift, other insight kinds, cohort stats and the minimum-cohort privacy rule.
import { DEFAULT_WEIGHTS } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import {
  buildInsights,
  clashInsights,
  cohortStats,
  counterfactuals,
  demand,
  interestedButUnconvinced,
  overlooked,
  type InsightContext,
} from '../src/engines/index.ts';
import { makeModule, makeProfile, makeSlot } from './engines-fixtures.ts';

// Interested in fluids and thermodynamics, uneasy with maths.
const interested = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    makeProfile({
      studentId: `keen-${i}`,
      interests: { 'fluid-mechanics': 1, 'thermodynamics-energy': 1 },
      style: { ...makeProfile().style, mathsComfort: 0.2 },
    }),
  );
const uninterested = Array.from({ length: 3 }, (_, i) => makeProfile({ studentId: `other-${i}` }));

// I = 0.5, L = 0.3, so Fit = round(100 · (0.45·0.5 + 0.2·0.3) / 0.75) = 38.
const target = makeModule('target', {
  topics: { 'fluid-mechanics': 1, 'policy-ethics': 1 },
  demand: { examShare: 0.5, groupShare: 0.5, applied: 0.5, mathsIntensity: 0.9, codingIntensity: 0.5, workload: 0.5 },
  capacity: 100,
});
const filler = (id: string) => makeModule(id, { topics: { languages: 1 } });

function context(cohortSize: number, shortlists: string[][] = []): InsightContext {
  return {
    modules: [target, filler('f1'), filler('f2')],
    cohort: [...interested(cohortSize), ...uninterested],
    shortlists,
    weights: DEFAULT_WEIGHTS,
    homeTopics: {},
    slots: [makeSlot('target', 'mon', '09:00', '10:00'), makeSlot('f1', 'mon', '09:00', '10:00')],
  };
}

describe('interestedButUnconvinced', () => {
  it('selects students with I ≥ 0.5 and fit below 75', () => {
    const ctx = context(6);
    expect(interestedButUnconvinced(target, ctx.cohort, ctx.weights, ctx.homeTopics)).toHaveLength(6);
  });
});

describe('counterfactuals', () => {
  it('returns positive uplifts only, best first', () => {
    const ctx = context(6);
    const results = counterfactuals(target, ctx.cohort, ctx.weights, ctx.homeTopics);
    // Lower maths 0.9 → 0.7: L = 0.5, fit 43 (+5). Add thermodynamics at 0.3: I = 1.3 / 2.3, fit 42 (+4).
    expect(results.map((c) => [c.change, c.uplift])).toEqual([
      [{ kind: 'shift-demand', field: 'mathsIntensity', delta: -0.2 }, 5],
      [{ kind: 'add-topic', topic: 'thermodynamics-energy', weight: 0.3 }, 4],
    ]);
    expect(results.every((c) => c.uplift > 0 && c.groupSize === 6)).toBe(true);
    expect(results[0]?.description).toBe('Lower maths intensity from 0.90 to 0.70');
  });

  it('is blocked for a group under five students', () => {
    const ctx = context(4);
    expect(counterfactuals(target, ctx.cohort, ctx.weights, ctx.homeTopics)).toEqual([]);
  });
});

describe('cohortStats', () => {
  it('counts shortlists and buckets fits into ten bands', () => {
    const ctx = context(6, [['target'], ['target', 'f1'], ['f2']]);
    const stats = cohortStats(target, ctx.cohort, ctx.shortlists, ctx.weights, ctx.homeTopics);
    // Uninterested students: I = 0, L neutral 0.5, fit round(100 · 0.1 / 0.75) = 13.
    expect(stats).toEqual({
      cohortSize: 9,
      shortlisted: 2,
      averageFit: 29.7,
      fitHistogram: [0, 3, 0, 6, 0, 0, 0, 0, 0, 0],
    });
  });

  it('is withheld for a cohort under five', () => {
    expect(cohortStats(target, interested(4), [], DEFAULT_WEIGHTS, {})).toBeNull();
  });
});

describe('insight cards', () => {
  it('builds counterfactual cards with deterministic ids and pending decisions', () => {
    const insights = buildInsights(target, context(6));
    const cards = insights.filter((insight) => insight.kind === 'COUNTERFACTUAL');
    expect(cards.map((card) => card.id)).toEqual(['target:COUNTERFACTUAL:1', 'target:COUNTERFACTUAL:2']);
    expect(cards[0]).toMatchObject({ moduleId: 'target', cohortSize: 6, upliftPoints: 5, decision: 'pending' });
    expect(cards[0]?.headline).toContain('+5.0 fit points');
    expect(buildInsights(target, context(6))).toEqual(insights);
  });

  it('flags an overlooked module: above-median fit, under 20% of capacity shortlisted', () => {
    const card = overlooked(target, context(6, [['target']]));
    expect(card).toMatchObject({ id: 'target:OVERLOOKED:1', kind: 'OVERLOOKED', cohortSize: 9 });
    expect(card?.detail).toContain('1% of its 100 places');
    const popular = Array.from({ length: 20 }, () => ['target']);
    expect(overlooked(target, context(6, popular))).toBeNull();
  });

  it('flags demand near or over capacity, but not from fewer than five students', () => {
    const small = { ...target, capacity: 5 };
    const five = Array.from({ length: 5 }, () => ['target']);
    expect(demand(small, context(6, five))?.headline).toContain('5 shortlists for 5 places (100%)');
    expect(demand({ ...target, capacity: 4 }, context(6, five.slice(0, 4)))).toBeNull();
  });

  it('reports clash pairs only when five or more students share them', () => {
    const pairs = (n: number) => Array.from({ length: n }, () => ['target', 'f1']);
    const [card, ...rest] = clashInsights(target, context(6, pairs(5)));
    expect(rest).toEqual([]);
    expect(card).toMatchObject({ id: 'target:CLASH:1', kind: 'CLASH', cohortSize: 5 });
    expect(card?.headline).toContain('F1 Module f1');
    expect(clashInsights(target, context(6, pairs(4)))).toEqual([]);
  });

  it('returns no insight at all when the cohort behind it is under five', () => {
    const shortlists = Array.from({ length: 4 }, () => ['target', 'f1']);
    const ctx = { ...context(4, shortlists), cohort: interested(4) };
    expect(buildInsights({ ...target, capacity: 4 }, ctx)).toEqual([]);
  });
});
