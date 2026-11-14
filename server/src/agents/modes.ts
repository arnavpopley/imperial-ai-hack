// Mode machine (spec 12). Every allowed transition is listed here; anything else is refused and traced.
import type { Mode } from '@modulematch/shared';

const TRANSITIONS: Record<Mode, Mode[]> = {
  ONBOARD: ['INTERVIEW'],
  INTERVIEW: ['RECOMMEND', 'ESCALATED'],
  RECOMMEND: ['EXPLAIN', 'INTERVIEW', 'PLAN', 'ESCALATED'],
  EXPLAIN: ['RECOMMEND'],
  PLAN: ['RECOMMEND', 'ESCALATED'],
  ESCALATED: ['RECOMMEND'],
};

export function canTransition(from: Mode, to: Mode): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * The mode a session should leave ESCALATED or EXPLAIN for, and the route from any mode back to
 * RECOMMEND. EXPLAIN and PLAN are transient: they return to RECOMMEND once their turn is done.
 */
export const RESTING_MODE: Mode = 'RECOMMEND';
