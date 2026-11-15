// Pure helpers for the exam feedback page: lost-mark bars and the revision checklist kept in localStorage.
import type { ModuleResult, TailoredFeedback } from '@modulematch/shared';

export interface LostMarksRow {
  questionId: string;
  lost: number;
  /** The question's maximum, from the student's own mark sheet, when it shows one. */
  maxMarks: number | null;
  /** Bar width for the lost marks, 0 to 1: of the question's maximum, or of the largest loss when that is unknown. */
  lostShare: number;
  /** Bar width for the marks scored, 0 to 1, when the maximum is known. */
  scoredShare: number;
}

/** One bar per weak point, joining the student's question marks for the same exam when they exist. */
export function lostMarksRows(weakPoints: TailoredFeedback['weakPoints'], result: ModuleResult | undefined): LostMarksRow[] {
  const largest = Math.max(0, ...weakPoints.map((w) => w.lostMarks));
  return weakPoints.map((w) => {
    const question = result?.questionMarks.find((q) => q.questionId === w.questionId);
    if (question && question.maxMarks > 0) {
      const lost = Math.min(w.lostMarks, question.maxMarks);
      return {
        questionId: w.questionId,
        lost: w.lostMarks,
        maxMarks: question.maxMarks,
        lostShare: lost / question.maxMarks,
        scoredShare: Math.min(question.mark, question.maxMarks - lost) / question.maxMarks,
      };
    }
    return {
      questionId: w.questionId,
      lost: w.lostMarks,
      maxMarks: null,
      lostShare: largest > 0 ? w.lostMarks / largest : 0,
      scoredShare: 0,
    };
  });
}

/** "Q3" stays "Q3"; "q3" or "3" read as "Question 3". */
export function questionLabel(questionId: string): string {
  const match = /^(?:q(?:uestion)?\s*)?(\d+[a-z]?)$/i.exec(questionId.trim());
  return match ? `Question ${match[1]}` : questionId;
}

export const formatMarks = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The revision checklist is per session and exam, and remembers items by their text so reordering is safe. */
export const revisionKey = (sessionId: string, moduleId: string, examLabel: string) =>
  `modulematch.revision.${sessionId}.${moduleId}.${examLabel}`;

export function readChecked(key: string): string[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function writeChecked(key: string, checked: readonly string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(checked));
  } catch {
    // Storage is blocked: the ticks still show for this visit.
  }
}

/** Forget every revision checklist for a session, when its marks or the whole profile are deleted. */
export function clearRevisionChecklists(sessionId: string): void {
  try {
    const prefix = `modulematch.revision.${sessionId}.`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Storage is blocked, so nothing was saved either.
  }
}

/** Toggle an item, keeping only items still on the plan. */
export function toggleItem(checked: readonly string[], item: string, plan: readonly string[]): string[] {
  const next = checked.includes(item) ? checked.filter((c) => c !== item) : [...checked, item];
  return next.filter((c) => plan.includes(c));
}
