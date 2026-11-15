// Issue 144: interest strength as a three-step dot row on the "Here is what I heard" card.
import { describe, expect, it } from 'vitest';
import { STRENGTH_LABELS, strengthStep } from './heard.ts';

describe('strengthStep', () => {
  it('splits strength into light, medium and strong', () => {
    expect(strengthStep(0.3)).toBe(1);
    expect(strengthStep(0.59)).toBe(1);
    expect(strengthStep(0.6)).toBe(2);
    expect(strengthStep(0.79)).toBe(2);
    expect(strengthStep(0.8)).toBe(3);
    expect(strengthStep(1)).toBe(3);
  });

  it('names each step for screen readers', () => {
    expect(STRENGTH_LABELS[3]).toBe('strong interest');
    expect(STRENGTH_LABELS[1]).toBe('light interest');
  });
});
