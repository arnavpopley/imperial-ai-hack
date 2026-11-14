// Answer feedback aggregation (deterministic): the staff summary and the JSONL export rows. Inputs are stored
// Feedback items, whose free text was redacted (G2, G3) before storage.
import { schemas, type Feedback, type FeedbackExportRow, type FeedbackSummary } from '@modulematch/shared';

/** How many recent down-votes the staff summary lists. */
export const RECENT_DOWN_LIMIT = 20;

/** Totals, up and down by target kind, and the most recent down-votes. `items` must be newest first. */
export function summariseFeedback(items: readonly Feedback[], recentLimit = RECENT_DOWN_LIMIT): FeedbackSummary {
  const byKind = schemas.FeedbackTargetKind.options.map((kind) => {
    const ofKind = items.filter((f) => f.target.kind === kind);
    return { kind, up: ofKind.filter((f) => f.rating === 'up').length, down: ofKind.filter((f) => f.rating === 'down').length };
  });
  const up = items.filter((f) => f.rating === 'up').length;
  return {
    total: items.length,
    up,
    down: items.length - up,
    byKind,
    recentDown: items
      .filter((f) => f.rating === 'down')
      .slice(0, recentLimit)
      .map((f) => ({
        id: f.id,
        kind: f.target.kind,
        moduleId: f.target.moduleId ?? null,
        reason: f.reason ?? null,
        comment: f.comment ?? null,
        question: f.question ?? null,
        answerExcerpt: f.answerExcerpt ?? null,
        createdAt: f.createdAt,
      })),
  };
}

export function feedbackExportRow(f: Feedback): FeedbackExportRow {
  return {
    question: f.question ?? null,
    answer: f.answerExcerpt ?? null,
    rating: f.rating,
    reason: f.reason ?? null,
    comment: f.comment ?? null,
    kind: f.target.kind,
    moduleId: f.target.moduleId ?? null,
  };
}

/** One JSON object per line, oldest first, each ending in a newline (empty when there is no feedback). */
export function feedbackJsonl(newestFirst: readonly Feedback[]): string {
  return [...newestFirst]
    .reverse()
    .map((f) => `${JSON.stringify(feedbackExportRow(f))}\n`)
    .join('');
}
