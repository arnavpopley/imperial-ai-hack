// Spec 9.3 and 20.4: staff see aggregates only, and nothing drawn from a cohort under MIN_COHORT students.
import { MIN_COHORT } from '@modulematch/shared';
import type { StaffModuleSummary } from '@modulematch/shared';

export const isCohortVisible = (m: StaffModuleSummary): boolean => m.cohortSize >= MIN_COHORT;

type Compare = (a: StaffModuleSummary, b: StaffModuleSummary) => number;

/**
 * Orders modules by a cohort figure, highest first. Hidden cohorts always sort last, by code,
 * so their position in a list never reveals the figure that is being withheld.
 */
export function byCohortFigure(figure: (m: StaffModuleSummary) => number): Compare {
  return (a, b) => {
    const shownA = isCohortVisible(a);
    const shownB = isCohortVisible(b);
    if (shownA !== shownB) return shownA ? -1 : 1;
    if (!shownA) return a.code.localeCompare(b.code);
    return figure(b) - figure(a);
  };
}
