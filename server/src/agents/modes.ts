// Mode machine (spec 12). Every allowed transition is listed here; anything else is refused and traced.
import type { Mode } from '@modulematch/shared';

const TRANSITIONS: Record<Mode, Mode[]> = {
  ONBOARD: ['INTERVIEW'],
  INTERVIEW: ['RECOMMEND', 'ESCALATED'],
  RECOMMEND: ['EXPLAIN', 'INTERVIEW', 'PLAN', 'ESCALATED'],
  // An escalation can be sent from another tab while an explanation is being written.
  EXPLAIN: ['RECOMMEND', 'PLAN', 'ESCALATED'],
  PLAN: ['EXPLAIN', 'RECOMMEND', 'ESCALATED'],
  ESCALATED: ['RECOMMEND'],
};

export function canTransition(from: Mode, to: Mode): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Spec 12: the mode a shortlist of this size implies, PLAN at two or more modules and RECOMMEND below.
 * The one rule behind shortlist edits (syncPlanMode) and the end of an explanation or what-if (leaveExplain).
 */
export function restingModeFor(shortlist: readonly string[]): 'PLAN' | 'RECOMMEND' {
  return shortlist.length >= 2 ? 'PLAN' : 'RECOMMEND';
}
