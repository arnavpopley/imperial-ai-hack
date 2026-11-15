// Guards the exam feedback page's lost-mark bars and revision checklist logic.
import type { ModuleResult, TailoredFeedback } from '@modulematch/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  byGap,
  clearRevisionChecklists,
  examAnchor,
  examGap,
  examMark,
  questionBars,
  questionLabel,
  readChecked,
  revisionKey,
  toggleItem,
  writeChecked,
} from './plan.ts';

const result: ModuleResult = {
  moduleId: 'MECH50010',
  code: 'MECH50010',
  title: 'Fluid Mechanics 2',
  mark: 58,
  questionMarks: [
    { questionId: 'Q1', mark: 16, maxMarks: 20 },
    { questionId: 'Q3', mark: 7, maxMarks: 20 },
  ],
  matched: true,
  source: 'pasted-text',
};

describe('questionBars', () => {
  const feedback = (extra: Partial<TailoredFeedback> = {}): TailoredFeedback => ({
    moduleId: 'MECH50010',
    examLabel: 'Summer 2026 exam',
    overall: 'Most marks went on Q3.',
    strengths: [],
    weakPoints: [{ questionId: 'Q3', label: 'Boundary layers', topics: ['fluid-mechanics'], lostMarks: 13, advice: '' }],
    revisionPlan: [],
    affectsModules: [],
    source: 'template',
    ...extra,
  });

  it('charts every question from the student mark sheet, marking the weak ones (ignoring case and spaces)', () => {
    const bars = questionBars(feedback({ weakPoints: [{ questionId: ' q3 ', topics: [], lostMarks: 13, advice: '' }] }), result);
    expect(bars.map((b) => [b.questionId, b.weak])).toEqual([
      ['Q1', false],
      ['Q3', true],
    ]);
    expect(bars[1]).toMatchObject({ scoredShare: 7 / 20, lostShare: 13 / 20 });
  });

  it('uses the server labels and sends, but keeps every uploaded question, even ones the form does not cover', () => {
    const bars = questionBars(
      feedback({
        questions: [
          { questionId: 'q3', label: 'Boundary layers', mark: 7, maxMarks: 20 },
          { questionId: 'Q5', label: 'Nozzles', mark: 11, maxMarks: 20 },
        ],
      }),
      result,
    );
    expect(bars.map((b) => [b.questionId, b.label, b.mark])).toEqual([
      ['Q1', '', 16],
      ['Q3', 'Boundary layers', 7],
      ['Q5', 'Nozzles', 11],
    ]);
    // Marks lost on a question outside the form still count towards the exam's place in the list.
    expect(examGap(bars, null)).toBeCloseTo((4 + 13 + 9) / 60);
  });

  it('never draws more than a full bar', () => {
    const [bar] = questionBars(feedback({ questions: [{ questionId: 'Q1', label: '', mark: 30, maxMarks: 20 }] }), undefined);
    expect((bar?.scoredShare ?? 0) + (bar?.lostShare ?? 0)).toBe(1);
  });

  it('puts the exam with most marks lost first, falling back to the overall mark', () => {
    const bars = questionBars(feedback(), result);
    expect(examGap(bars, 58)).toBeCloseTo(17 / 40);
    expect(examGap([], 57)).toBeCloseTo(0.43);
    expect(examGap([], null)).toBe(0);
    expect(byGap([{ id: 'a', gap: 0.2 }, { id: 'b', gap: 0.4 }, { id: 'c', gap: 0.2 }]).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(examMark(feedback({ mark: 57 }), result)).toBe(57);
    expect(examMark(feedback(), result)).toBe(58);
    expect(examAnchor('MECH50010', 'Summer 2026 exam')).toBe('exam-mech50010-summer-2026-exam');
  });
});

describe('revision checklist', () => {
  it('toggles items and drops ones no longer on the plan', () => {
    const plan = ['Rework Q3', 'Past paper 2024'];
    expect(toggleItem([], 'Rework Q3', plan)).toEqual(['Rework Q3']);
    expect(toggleItem(['Rework Q3', 'Old item'], 'Rework Q3', plan)).toEqual([]);
  });

  it("forgets a session's saved checklists when its marks are deleted, and only that session's", () => {
    const store = new Map<string, string>();
    const localStorage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    vi.stubGlobal('window', { localStorage });
    try {
      writeChecked(revisionKey('s1', 'MECH50008', 'June 2026 exam'), ['Rework Q3']);
      writeChecked(revisionKey('s1', 'MECH50002', 'June 2026 exam'), ['Failure criteria']);
      writeChecked(revisionKey('s2', 'MECH50008', 'June 2026 exam'), ['Rework Q3']);
      clearRevisionChecklists('s1');
      expect([...store.keys()]).toEqual([revisionKey('s2', 'MECH50008', 'June 2026 exam')]);
      expect(readChecked(revisionKey('s1', 'MECH50008', 'June 2026 exam'))).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('labels question ids for reading', () => {
    expect(questionLabel('Q3')).toBe('Question 3');
    expect(questionLabel('2b')).toBe('Question 2b');
    expect(questionLabel('Section A')).toBe('Section A');
  });
});
