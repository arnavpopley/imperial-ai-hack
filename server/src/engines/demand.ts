// Aggregate demand against capacity for students (issue #68): the same shortlist count and thresholds staff see.
import { MIN_COHORT, capacityStatus } from '@modulematch/shared';
import type { Module, ModuleDemandSignal } from '@modulematch/shared';

/**
 * Capped modules whose cohort shortlists reach NEAR_CAPACITY or more. A module is left out when fewer than
 * MIN_COHORT students sit behind the count, or the cohort itself is under MIN_COHORT (spec 20.4).
 * Informational only: nothing here touches fit scores or ranking.
 */
export function demandSignals(modules: readonly Module[], shortlists: readonly (readonly string[])[]): ModuleDemandSignal[] {
  if (shortlists.length < MIN_COHORT) return [];
  return modules.flatMap((m) => {
    if (m.capacity === null) return [];
    const shortlisted = shortlists.filter((list) => list.includes(m.id)).length;
    if (shortlisted < MIN_COHORT) return [];
    const status = capacityStatus(shortlisted, m.capacity);
    return status === 'near' || status === 'over' ? [{ moduleId: m.id, status, shortlisted, capacity: m.capacity }] : [];
  });
}
