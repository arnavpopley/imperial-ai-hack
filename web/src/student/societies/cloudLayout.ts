// Geometry for the society bubble cloud, in percent of the (square) cloud's width.
//
// Bubbles are circles, so their footprint does not change as they counter-rotate to stay upright, and both
// rings turn together as one rigid body, so the distance between any two bubbles never changes. A layout that
// is collision-free at rest is therefore collision-free at every moment of the orbit and at every screen width.
//
// The inner ring holds up to six bubbles (top five and the wildcard). The outer ring holds the same number,
// each one sitting in the gap between two inner bubbles rather than behind one.

export const CENTRE_DIAMETER = 20;
export const INNER_RADIUS = 24;
export const OUTER_RADIUS = 40;
export const MAX_PER_RING = 6;
/** Inner bubbles range from 18 to 22 by fit; the wildcard is 20. */
export const INNER_MIN = 18;
export const INNER_MAX = 22;
export const WILDCARD_DIAMETER = 20;
export const OUTER_DIAMETER = 17;
/** Smallest clear space between two bubbles, or between a bubble and the centre or the edge. */
export const MIN_GAP = 1.5;

export interface Placement {
  /** Centre, in percent of the cloud's width from its left and top edges. */
  x: number;
  y: number;
  diameter: number;
}

function onRing(index: number, count: number, radius: number, offset: number): { x: number; y: number } {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2 + offset;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

/**
 * Places the inner bubbles (diameters given, at most MAX_PER_RING) and `outerCount` outer bubbles (at most
 * the inner count, so each one gets a gap of its own). Callers slice their lists to fit.
 */
export function cloudLayout(innerDiameters: readonly number[], outerCount: number): { inner: Placement[]; outer: Placement[] } {
  const n = Math.min(innerDiameters.length, MAX_PER_RING);
  const inner = innerDiameters.slice(0, n).map((diameter, i) => ({ ...onRing(i, n, INNER_RADIUS, 0), diameter }));
  // Half a step round from each inner bubble, so outer bubbles sit in the gaps. With no inner ring, start at the top.
  const slots = Math.max(n, 1);
  const outer = Array.from({ length: Math.min(outerCount, slots) }, (_, i) => ({
    ...onRing(i, slots, OUTER_RADIUS, n > 0 ? Math.PI / slots : 0),
    diameter: OUTER_DIAMETER,
  }));
  return { inner, outer };
}

/**
 * Splits a label at word boundaries into at most `maxLines` lines, keeping the longest line as short as possible,
 * so a bubble never breaks a word in the middle. Words are never split; a line that still does not fit is
 * truncated with an ellipsis by the caller.
 */
export function splitLabel(label: string, maxLines: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  const lines = Math.min(maxLines, words.length);
  const width = (from: number, to: number) => words.slice(from, to).join(' ').length;
  // best[k][i]: the shortest possible longest line when words[i..] is laid out on k lines.
  const best: number[][] = Array.from({ length: lines + 1 }, () => Array<number>(words.length + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: lines + 1 }, () => Array<number>(words.length + 1).fill(words.length));
  // No words left costs nothing, whatever lines remain unused.
  for (const row of best) row[words.length] = 0;
  for (let k = 1; k <= lines; k++) {
    for (let i = words.length - 1; i >= 0; i--) {
      for (let j = i + 1; j <= words.length; j++) {
        const cost = Math.max(width(i, j), best[k - 1]![j]!);
        if (cost < best[k]![i]!) {
          best[k]![i] = cost;
          cut[k]![i] = j;
        }
      }
    }
  }
  const result: string[] = [];
  for (let k = lines, i = 0; k > 0 && i < words.length; k--) {
    const j = cut[k]![i]!;
    result.push(words.slice(i, j).join(' '));
    i = j;
  }
  return result;
}

/** The smallest clear gap in a layout: between bubbles, to the centre circle and to the cloud's edge. */
export function smallestGap(placements: readonly Placement[]): number {
  let gap = Infinity;
  for (const [i, a] of placements.entries()) {
    const fromCentre = Math.hypot(a.x - 50, a.y - 50);
    gap = Math.min(gap, fromCentre - a.diameter / 2 - CENTRE_DIAMETER / 2, 50 - fromCentre - a.diameter / 2);
    for (const b of placements.slice(i + 1)) gap = Math.min(gap, Math.hypot(a.x - b.x, a.y - b.y) - (a.diameter + b.diameter) / 2);
  }
  return gap;
}
