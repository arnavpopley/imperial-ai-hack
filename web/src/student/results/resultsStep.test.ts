// Year 1 students have no university marks yet, so the results step is offered from Year 2 only (issue #114).
import { describe, expect, it } from 'vitest';
import { offersResultsStep, resultsStepStatus } from './resultsStep.ts';

describe('results step', () => {
  it('is offered from Year 2, never in Year 1', () => {
    expect([1, 2, 3, 4].map(offersResultsStep)).toEqual([false, true, true, true]);
  });

  it('is done once marks are stored, otherwise skipped or still to do', () => {
    expect(resultsStepStatus(true, { offered: true, skipped: true })).toBe('done');
    expect(resultsStepStatus(false, { offered: true, skipped: true })).toBe('skipped');
    expect(resultsStepStatus(false, { offered: false, skipped: false })).toBe('todo');
  });
});
