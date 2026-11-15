// Spec 20.4: staff views are aggregate only, with a minimum of five students behind any figure. A count of one to
// four students is withheld before it leaves the API; zero and five or more are shown as they are.
import { MIN_COHORT } from '@modulematch/shared';

/** True for a count of students too small to show staff: one to four. */
export const isSmallCount = (n: number): boolean => n > 0 && n < MIN_COHORT;

/** The count, or null when it is one to four students. */
export const withheld = (n: number): number | null => (isSmallCount(n) ? null : n);

/** A count for staff-facing text: "fewer than 5" for one to four students, otherwise the number. */
export const countText = (n: number): string => (isSmallCount(n) ? `fewer than ${MIN_COHORT}` : String(n));

/**
 * Counts that split one published group between them (they add up to its size). Each is shown only when every part
 * is zero or at least MIN_COHORT; otherwise every non-zero part is null, because with the group's size known a
 * single small part could be worked out from the others by subtraction.
 */
export function partitionCounts(parts: readonly number[]): (number | null)[] {
  const safe = parts.every((n) => !isSmallCount(n));
  return parts.map((n) => (safe || n === 0 ? n : null));
}

/** Fit points per histogram bucket. */
const BUCKET = 10;

export interface FitBand {
  /** Lowest fit in the band. */
  from: number;
  /** Highest fit in the band (100 for the top band). */
  to: number;
  students: number;
}

const bandOf = (first: number, last: number, students: number): FitBand => ({
  from: first * BUCKET,
  to: last === 100 / BUCKET - 1 ? 100 : last * BUCKET + BUCKET - 1,
  students,
});

/**
 * Neighbouring buckets merged, low to high, until every band holds no students or at least MIN_COHORT. A small
 * remainder at the top folds back into the bands below it. Needs a segment total of zero or MIN_COHORT or more.
 */
function mergeSegment(counts: readonly number[], first: number): FitBand[] {
  const bands: FitBand[] = [];
  let start = first;
  let students = 0;
  counts.forEach((n, k) => {
    const i = first + k;
    if (students === 0 && n === 0) {
      bands.push(bandOf(i, i, 0));
      start = i + 1;
      return;
    }
    students += n;
    if (students >= MIN_COHORT) {
      bands.push(bandOf(start, i, students));
      start = i + 1;
      students = 0;
    }
  });
  if (students > 0) {
    const last = first + counts.length - 1;
    while (students < MIN_COHORT && bands.length > 0) {
      const below = bands.pop()!;
      students += below.students;
      start = below.from / BUCKET;
    }
    bands.push(bandOf(start, last, students));
  }
  return bands;
}

const sum = (xs: readonly number[]) => xs.reduce((total, n) => total + n, 0);

/**
 * Spec 20.4 for the staff fit distribution. Merging rather than hiding small bands means every published band is
 * zero or at least MIN_COHORT, and they add up to the cohort, so no band can be worked out by subtraction.
 *
 * Bands never cross a line in `floors` (for example the good- and strong-fit floors), which keeps the count above
 * each line exact and consistent with the bands. A line comes out only when a stretch between lines holds one to
 * four students: that stretch merges with its neighbour, and the count above the removed line is withheld (null),
 * since it would give the small stretch away.
 */
export function staffFitBands(
  histogram: readonly number[],
  floors: readonly number[],
): { bands: FitBand[]; above: Map<number, number | null> } {
  let cuts = [...new Set(floors.map((f) => f / BUCKET))].filter((c) => c > 0 && c < histogram.length).sort((a, b) => a - b);
  const stretches = () => [0, ...cuts, histogram.length].slice(0, -1).map((start, i, starts) => [start, [...cuts, histogram.length][i]!] as const);
  for (;;) {
    const small = stretches().findIndex(([from, to]) => isSmallCount(sum(histogram.slice(from, to))));
    // With no lines left there is one stretch, the whole cohort, which callers only pass at MIN_COHORT or more.
    if (small < 0 || cuts.length === 0) break;
    // Join the small stretch to the one above it, or, for the top stretch, to the one below.
    cuts = cuts.filter((_, i) => i !== (small < cuts.length ? small : small - 1));
  }
  const bands = stretches().flatMap(([from, to]) => mergeSegment(histogram.slice(from, to), from));
  const above = new Map(floors.map((f) => [f, cuts.includes(f / BUCKET) ? sum(histogram.slice(f / BUCKET)) : null]));
  return { bands, above };
}
