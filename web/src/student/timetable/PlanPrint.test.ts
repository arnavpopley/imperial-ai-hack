// The printed plan's "top reason" follows the student's weights, as the printed fit does.
import { describe, expect, it } from 'vitest';
import { topReason } from './PlanPrint.tsx';

const sub = { interest: 0.9, goal: 0.6, style: 0.5, breadth: 0.2 };

describe('topReason', () => {
  it('names the sub-score that contributes most at the current weights', () => {
    expect(topReason(sub, { interest: 0.45, goal: 0.25, style: 0.2, breadth: 0.1 })).toBe('Interest');
    expect(topReason(sub, { interest: 0.1, goal: 0.8, style: 0.1, breadth: 0 })).toBe('Career goal');
  });

  it('never names a reason weighted to zero, and skips a missing career goal', () => {
    expect(topReason(sub, { interest: 0, goal: 0, style: 0.3, breadth: 0.1 })).toBe('Learning style');
    expect(topReason({ ...sub, goal: null }, { interest: 0, goal: 1, style: 0, breadth: 0.2 })).toBe('Breadth');
    expect(topReason(sub, { interest: 0, goal: 0, style: 0, breadth: 0 })).toBeNull();
  });
});
