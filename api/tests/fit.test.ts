import { combineFit, DEFAULT_WEIGHTS } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';

describe('combineFit', () => {
  const sub = { interest: 0.8, goal: 0.6, style: 0.5, breadth: 0.2 };

  it('applies the default weights', () => {
    // (0.45*0.8 + 0.25*0.6 + 0.2*0.5 + 0.1*0.2) / 1.0 = 0.63
    expect(combineFit(sub, DEFAULT_WEIGHTS)).toBe(63);
  });

  it('drops the goal weight when goal is null', () => {
    // (0.45*0.8 + 0.2*0.5 + 0.1*0.2) / 0.75 = 0.64
    expect(combineFit({ ...sub, goal: null }, DEFAULT_WEIGHTS)).toBe(64);
  });

  it('renormalises arbitrary weights', () => {
    expect(combineFit(sub, { interest: 2, goal: 0, style: 0, breadth: 0 })).toBe(80);
  });

  it('returns 0 when every weight is zero', () => {
    expect(combineFit(sub, { interest: 0, goal: 0, style: 0, breadth: 0 })).toBe(0);
  });
});
