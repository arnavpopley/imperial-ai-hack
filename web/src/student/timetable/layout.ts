// Pure layout helpers for the weekly grid: time maths, side-by-side lanes and clash overlap bands.
import type { Clash, ClashLabel, Slot, Term, Weekday } from '@modulematch/shared';

export const DAY_START = 9 * 60;
export const DAY_END = 18 * 60;
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => 9 + i);

export function toMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/** Percentage offset of a time within the 09:00 to 18:00 day, clamped to the grid. */
export function dayOffset(minutes: number): number {
  const clamped = Math.min(DAY_END, Math.max(DAY_START, minutes));
  return ((clamped - DAY_START) / (DAY_END - DAY_START)) * 100;
}

export interface PlacedSlot {
  slot: Slot;
  lane: number;
  lanes: number;
}

/** Groups overlapping slots into clusters and gives each a lane, so overlaps sit side by side. */
export function layoutDay(slots: readonly Slot[]): PlacedSlot[] {
  const sorted = [...slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const placed: PlacedSlot[] = [];
  let cluster: PlacedSlot[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const slot of sorted) {
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (start >= clusterEnd && cluster.length > 0) closeCluster();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ slot, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) closeCluster();
  return placed;
}

export interface OverlapBand {
  key: string;
  day: Weekday;
  start: number;
  end: number;
  label: ClashLabel;
  probability: number;
}

/** The time ranges where clashing slots overlap in one term, one band per distinct range. */
export function overlapBands(clashes: readonly Clash[], term: Term): OverlapBand[] {
  const bands = new Map<string, OverlapBand>();
  for (const clash of clashes) {
    if (clash.term !== term) continue;
    for (const { a, b } of clash.overlaps) {
      if (a.day !== b.day) continue;
      const start = Math.max(toMinutes(a.start), toMinutes(b.start));
      const end = Math.min(toMinutes(a.end), toMinutes(b.end));
      if (end <= start) continue;
      const key = `${a.day}-${start}-${end}`;
      const existing = bands.get(key);
      if (!existing || clash.probability > existing.probability) {
        bands.set(key, { key, day: a.day, start, end, label: clash.label, probability: clash.probability });
      }
    }
  }
  return [...bands.values()];
}

/** Identifies a slot across clashes: the same module and session can appear in several overlaps. */
export const slotKey = (slot: Slot) => `${slot.moduleId}|${slot.sessionKey}|${slot.day}|${slot.start}`;

export const formatRange = (start: number, end: number) => `${hhmm(start)}–${hhmm(end)}`;

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
