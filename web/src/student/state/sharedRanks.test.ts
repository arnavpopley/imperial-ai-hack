// Issue #50: identical fits never show distinct ranks, the eligibility gate starts a new rank, the starter order
// is never re-sorted on the client, and rank arrows are measured in the ranks students see.
import { DEFAULT_WEIGHTS } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { rankForView, sharedRanks, type Ordered } from './CatalogueProvider.tsx';

const rec = (moduleId: string, fit: number, eligible = true, position = 0): Ordered => ({
  moduleId,
  fit,
  position,
  sub: { interest: 0, goal: null, style: 0.5, breadth: 0 },
  eligible,
  ineligibleReasons: [],
  confidence: 'low',
});

describe('sharedRanks', () => {
  it('gives equal fits the same rank and skips the places they share', () => {
    expect(sharedRanks([rec('a', 80), rec('b', 70), rec('c', 70), rec('d', 60)])).toEqual([1, 2, 2, 4]);
  });

  it('ranks a whole list of identical fits as one tie', () => {
    expect(sharedRanks([rec('a', 13), rec('b', 13), rec('c', 13)])).toEqual([1, 1, 1]);
  });

  it('does not tie an eligible module with an ineligible one of the same fit', () => {
    expect(sharedRanks([rec('a', 50), rec('b', 50, false)])).toEqual([1, 2]);
  });
});

describe('rankForView', () => {
  const styled = (moduleId: string, style: number) => ({ ...rec(moduleId, 0), sub: { interest: 0, goal: null, style, breadth: 0 } });

  it('keeps the server order for a starter ranking even when style alone would reorder it', () => {
    const recommendations = [styled('this-year', 0.2), styled('popular', 0.9), styled('core', 0.5)];
    const view = rankForView({ ranking: 'starter', recommendations }, DEFAULT_WEIGHTS);
    expect(view.map((r) => r.moduleId)).toEqual(['this-year', 'popular', 'core']);
    expect(rankForView({ ranking: 'fit', recommendations }, DEFAULT_WEIGHTS).map((r) => r.moduleId)).toEqual(['popular', 'core', 'this-year']);
  });

  it('measures moves in the shared ranks shown: joining a tie for first is one place up, from #2 to #1', () => {
    // At default weights a leads b; with interest weight 0 they tie, so both show #1 and only b moved.
    const a = { ...rec('a', 0), sub: { interest: 1, goal: null, style: 0.5, breadth: 0 } };
    const b = { ...rec('b', 0), sub: { interest: 0, goal: null, style: 0.5, breadth: 0 } };
    const view = rankForView({ ranking: 'fit', recommendations: [a, b] }, { ...DEFAULT_WEIGHTS, interest: 0 });
    expect(view.map((r) => [r.moduleId, r.rank, r.rankShift])).toEqual([
      ['a', 1, 0],
      ['b', 1, 1],
    ]);
  });
});
