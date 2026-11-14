// Spec 9.2 overlap and clash probability, used by generate-slots.ts to report its clashes and by the data
// tests. The timetable engine owned by WS2 is the source of truth at runtime; this copy only checks seed data.
import type { Slot } from '@modulematch/shared';

/** Two slots overlap when they share a term and a day and their times intersect. HH:MM strings sort by time. */
export function overlaps(a: Slot, b: Slot): boolean {
  if (a.term !== b.term || a.day !== b.day) return false;
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start < end;
}

function bySession(slots: Slot[]): Slot[][] {
  const groups = new Map<string, Slot[]>();
  for (const s of slots) groups.set(s.sessionKey, [...(groups.get(s.sessionKey) ?? []), s]);
  return [...groups.values()];
}

/** P(clash) between two modules' slots: 1 minus the product over session pairs of (1 - P of that pair overlapping). */
export function clashProbability(slotsA: Slot[], slotsB: Slot[]): number {
  let noClash = 1;
  for (const x of bySession(slotsA)) {
    for (const y of bySession(slotsB)) {
      let p = 0;
      for (const a of x) for (const b of y) if (overlaps(a, b)) p += a.probability * b.probability;
      noClash *= 1 - Math.min(1, p);
    }
  }
  return 1 - noClash;
}
