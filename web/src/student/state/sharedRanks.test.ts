// Issue #50: identical fits never show distinct ranks, and the eligibility gate starts a new rank.
import { describe, expect, it } from 'vitest';
import { sharedRanks, type Ordered } from './CatalogueProvider.tsx';

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
