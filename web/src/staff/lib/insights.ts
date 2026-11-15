// What happens after a staff decision on an insight card, and why a module may have no cards at all.
import { MIN_COHORT } from '@modulematch/shared';
import type { Insight, InsightKind } from '@modulematch/shared';

export interface Outcome {
  /** One line on what the decision did, for example "Logged for the module review". */
  title: string;
  /** Who acts next, or null when nobody needs to. */
  owner: string | null;
}

/** Who follows up an accepted card of each kind. */
const ACCEPTED: Record<InsightKind, Outcome> = {
  COUNTERFACTUAL: { title: 'Logged for the module review', owner: 'module lead' },
  OVERLOOKED: { title: 'Logged for the module review', owner: 'module lead' },
  DEMAND: { title: 'Logged for capacity planning', owner: 'module lead, with timetabling' },
  CLASH: { title: 'Logged for the timetabling review', owner: 'timetabling team' },
};

/** The outcome of a decided card; null while it is pending. */
export function outcomeOf(insight: Pick<Insight, 'kind' | 'decision'>): Outcome | null {
  switch (insight.decision) {
    case 'pending':
      return null;
    case 'accepted':
      return ACCEPTED[insight.kind];
    case 'noted':
      return { title: 'Noted for reference. No follow-up is logged', owner: null };
    case 'dismissed':
      return { title: 'Dismissed. No follow-up is logged', owner: null };
  }
}

/** A counterfactual card the engine wrote in place of changes too small to act on: it carries no uplift. */
export const isSummaryCard = (insight: Pick<Insight, 'kind' | 'upliftPoints'>): boolean =>
  insight.kind === 'COUNTERFACTUAL' && insight.upliftPoints === null;

/** A counterfactual change the tag editor can make, so an accepted card links to it. */
export const canEditTags = (insight: Pick<Insight, 'kind' | 'upliftPoints' | 'decision'>): boolean =>
  insight.decision === 'accepted' && insight.kind === 'COUNTERFACTUAL' && !isSummaryCard(insight);

/**
 * Why a module has no cards. The engine always writes a counterfactual card (or, over capacity, a demand
 * card) once MIN_COHORT students are interested but unconvinced, so an empty list means every group behind
 * a possible card is under MIN_COHORT.
 */
export const NO_INSIGHTS = {
  title: `Fewer than ${MIN_COHORT} students in any group`,
  body: `Every card needs at least ${MIN_COHORT} students behind it, to keep individuals unidentifiable. Fewer than ${MIN_COHORT} students are interested in this module's topics but not yet convinced by it, and no demand or timetable clash involves ${MIN_COHORT} or more.`,
} as const;
