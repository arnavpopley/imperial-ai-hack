// Pure helpers for the exam feedback page: the per-question chart, worst-exam-first order, and the revision
// checklist kept in localStorage.
import type { ModuleResult, TailoredFeedback } from '@modulematch/shared';

/** One question on the exam chart: what the student scored and lost, and whether it is one of the weak points. */
export interface QuestionBar {
  questionId: string;
  /** The question's subject, when known, such as "Boundary layers and the Blasius solution". */
  label: string;
  mark: number;
  maxMarks: number;
  /** Bar widths, 0 to 1, of the question's maximum. They never add up to more than 1. */
  scoredShare: number;
  lostShare: number;
  weak: boolean;
}

/** Question ids match as the server matches them: ignoring case and surrounding spaces ("q1" is "Q1"). */
const sameQuestion = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Every question on the paper, for the chart: from the feedback itself when the server sends them, otherwise from
 * the student's own mark sheet, with labels from the weak points.
 */
export function questionBars(feedback: TailoredFeedback, result: ModuleResult | undefined): QuestionBar[] {
  const source = feedback.questions?.length
    ? feedback.questions
    : (result?.questionMarks ?? []).map((q) => ({ ...q, label: '' }));
  return source
    .filter((q) => q.maxMarks > 0)
    .map((q) => {
      const weakPoint = feedback.weakPoints.find((w) => sameQuestion(w.questionId, q.questionId));
      const scored = Math.min(Math.max(q.mark, 0), q.maxMarks);
      return {
        questionId: q.questionId,
        label: q.label || weakPoint?.label || '',
        mark: q.mark,
        maxMarks: q.maxMarks,
        scoredShare: scored / q.maxMarks,
        lostShare: (q.maxMarks - scored) / q.maxMarks,
        weak: weakPoint !== undefined,
      };
    });
}

/** The student's overall mark on the exam, from the feedback or their own results. */
export const examMark = (feedback: TailoredFeedback, result: ModuleResult | undefined): number | null =>
  feedback.mark ?? result?.mark ?? null;

/** Share of the paper's marks lost, 0 to 1: from the questions when known, otherwise from the overall mark. */
export function examGap(bars: readonly QuestionBar[], mark: number | null): number {
  const total = bars.reduce((sum, b) => sum + b.maxMarks, 0);
  if (total > 0) return bars.reduce((sum, b) => sum + b.lostShare * b.maxMarks, 0) / total;
  return mark === null ? 0 : (100 - mark) / 100;
}

/** Most room to improve first; ties keep their original order. */
export function byGap<T extends { gap: number }>(items: readonly T[]): T[] {
  return items.map((item, index) => ({ item, index })).sort((a, b) => b.item.gap - a.item.gap || a.index - b.index).map((x) => x.item);
}

/** A stable element id for an exam's card, so the summary strip can jump to it. */
export const examAnchor = (moduleId: string, examLabel: string) =>
  `exam-${`${moduleId}-${examLabel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

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
