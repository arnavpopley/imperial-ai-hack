// Guards the exam feedback page's lost-mark bars and revision checklist logic.
import type { ModuleResult } from '@modulematch/shared';
import { describe, expect, it, vi } from 'vitest';
import { clearRevisionChecklists, lostMarksRows, questionLabel, readChecked, revisionKey, toggleItem, writeChecked } from './plan.ts';

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

describe('lostMarksRows', () => {
  const weak = [
    { questionId: 'Q3', topics: ['fluid-mechanics'], lostMarks: 13, advice: '' },
    { questionId: 'Q4', topics: [], lostMarks: 6.5, advice: '' },
  ];

  it('uses the question maximum from the student mark sheet when it has one', () => {
    const [q3] = lostMarksRows(weak, result);
    expect(q3).toMatchObject({ maxMarks: 20, lostShare: 13 / 20, scoredShare: 7 / 20 });
  });

  it('scales to the largest loss when the maximum is unknown', () => {
    const rows = lostMarksRows(weak, undefined);
    expect(rows.map((r) => r.lostShare)).toEqual([1, 0.5]);
    expect(rows.every((r) => r.maxMarks === null && r.scoredShare === 0)).toBe(true);
  });

  it('never draws more than a full bar', () => {
    const [row] = lostMarksRows([{ questionId: 'Q1', topics: [], lostMarks: 30, advice: '' }], result);
    expect((row?.lostShare ?? 0) + (row?.scoredShare ?? 0)).toBeLessThanOrEqual(1);
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
