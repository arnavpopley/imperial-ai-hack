import { describe, expect, it } from 'vitest';
import { ADD_MARKS_STATE, OPEN_RESULTS_STATE, wantsAddMarks, wantsResultsPanel } from '../routes.ts';
import { questionList } from './AwaitingMarks.tsx';

describe('awaiting-marks prompt', () => {
  it('names the question ids the mark sheet needs, as a range when they run Q1 to Qn', () => {
    expect(questionList(['Q1', 'Q2', 'Q3', 'Q4'])).toBe('Q1 to Q4');
    expect(questionList(['Q1', 'Q3a', 'Q3b'])).toBe('Q1, Q3a and Q3b');
    expect(questionList(['Q2'])).toBe('Q2');
    expect(questionList([])).toBe('');
  });

  it('opens the results panel in add mode, which keeps the marks already shared', () => {
    expect(wantsResultsPanel(ADD_MARKS_STATE)).toBe(true);
    expect(wantsAddMarks(ADD_MARKS_STATE)).toBe(true);
    expect(wantsAddMarks(OPEN_RESULTS_STATE)).toBe(false);
    expect(wantsAddMarks(null)).toBe(false);
  });
});
