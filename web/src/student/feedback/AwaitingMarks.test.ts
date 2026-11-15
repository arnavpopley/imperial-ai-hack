import { describe, expect, it } from 'vitest';
import { questionList } from './AwaitingMarks.tsx';

describe('awaiting-marks prompt', () => {
  it('names the question ids the mark sheet needs, as a range when they run Q1 to Qn', () => {
    expect(questionList(['Q1', 'Q2', 'Q3', 'Q4'])).toBe('Q1 to Q4');
    expect(questionList(['Q1', 'Q3a', 'Q3b'])).toBe('Q1, Q3a and Q3b');
    expect(questionList(['Q2'])).toBe('Q2');
    expect(questionList([])).toBe('');
  });
});
