// Issue #66: each slider shows its own raw level, and the shares that drive the fit score always total 100%.
import { DEFAULT_WEIGHTS } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { levelWord, weightShares } from './weightShares.ts';

const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);

describe('weight shares', () => {
  it('match the default weights', () => {
    expect(weightShares(DEFAULT_WEIGHTS, true)).toEqual({ interest: 45, goal: 25, style: 20, breadth: 10 });
  });

  it('move every share when one slider moves, but not the other levels', () => {
    const weights = { ...DEFAULT_WEIGHTS, breadth: 1 };
    const shares = weightShares(weights, true);
    expect(shares).toEqual({ interest: 24, goal: 13, style: 10, breadth: 53 });
    expect(sum(shares)).toBe(100);
    // The Interest thumb stays at 0.45, and its label says so, not "24%".
    expect(levelWord(weights.interest)).toBe('High');
  });

  it('leave Career out without a pathway, and still total 100%', () => {
    const shares = weightShares(DEFAULT_WEIGHTS, false);
    expect(shares.goal).toBe(0);
    expect(sum(shares)).toBe(100);
  });

  it('total 100% whatever the rounding', () => {
    for (let i = 0; i < 200; i++) {
      const w = { interest: (i % 7) / 6, goal: (i % 5) / 4, style: (i % 3) / 2, breadth: ((i * 7) % 11) / 10 };
      const shares = weightShares(w, i % 2 === 0);
      const any = w.interest + (i % 2 === 0 ? w.goal : 0) + w.style + w.breadth > 0;
      expect(sum(shares)).toBe(any ? 100 : 0);
    }
  });

  it('name each raw level', () => {
    expect([0, 0.1, 0.25, 0.45, 0.8].map(levelWord)).toEqual(['Off', 'Low', 'Medium', 'High', 'Very high']);
  });
});
