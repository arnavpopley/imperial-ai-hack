// Rule exceptions on the student side (spec 11.1): the reason a draft asks for, and the Senior Tutor's decision.
import { schemas } from '@modulematch/shared';
import type { EscalationDraft, EscalationType, ExceptionDecision, SessionState } from '@modulematch/shared';

export const REASON_MAX = schemas.EXCEPTION_REASON_MAX;

export const EXCEPTION_LABELS: Record<ExceptionDecision, string> = {
  approved: 'Exception approved by the Senior Tutor',
  declined: 'Exception declined by the Senior Tutor',
};

/** Rule-exception drafts ask for a one-line reason, so the tutor knows why; other drafts need only a summary. */
export const asksForReason = (type: EscalationType): boolean => type === 'RULE_EXCEPTION';

export function canSendDraft(type: EscalationType, summary: string, reason: string): boolean {
  return summary.trim().length > 0 && (!asksForReason(type) || reason.trim().length > 0);
}

/** One line only: a pasted line break would otherwise reach the tutor as part of the reason. */
export const oneLine = (text: string): string => text.replace(/\s*\n+\s*/g, ' ');

/**
 * A draft's identity: a new draft (another module, or a new suggested reason) gets a fresh card, so a stale reason
 * is never carried over, while polls that return the same draft keep what the student is typing.
 */
export function draftIdentity(draft: Pick<EscalationDraft, 'type' | 'summary' | 'moduleId' | 'reason'>): string {
  return [draft.type, draft.moduleId ?? '', draft.summary, draft.reason ?? ''].join('|');
}

/**
 * Changes whenever a Senior Tutor decision lands in the session, so the ranked list is fetched again and an
 * approved module turns eligible without a reload.
 */
export function decisionsKey(session: Pick<SessionState, 'exceptions' | 'escalations'>): string {
  const decided = session.escalations.flatMap((e) => (e.decision ? [`${e.id}:${e.decision}`] : []));
  return [...session.exceptions.map((e) => e.moduleId), ...decided].join(',');
}
