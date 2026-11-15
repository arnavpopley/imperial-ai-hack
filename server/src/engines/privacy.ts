// Spec 20.4: staff views are aggregate only, with a minimum of five students behind any figure. A count of one to
// four students is withheld before it leaves the API; zero and five or more are shown as they are.
import { MIN_COHORT } from '@modulematch/shared';

/** True for a count of students too small to show staff: one to four. */
export const isSmallCount = (n: number): boolean => n > 0 && n < MIN_COHORT;

/** The count, or null when it is one to four students. */
export const withheld = (n: number): number | null => (isSmallCount(n) ? null : n);

/** A count for staff-facing text: "fewer than 5" for one to four students, otherwise the number. */
export const countText = (n: number): string => (isSmallCount(n) ? `fewer than ${MIN_COHORT}` : String(n));

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

/**
 * Spec 20.4 for the staff fit distribution. Merging rather than hiding small bands means every published band is
 * zero or at least MIN_COHORT, and they add up to the cohort, so no band can be worked out by subtraction. The
 * buckets below and from `strongFloor` merge separately, which keeps the strong-fit count exact; when either side
 * holds one to four students that count would give them away, so the sides merge together and it is withheld.
 */
export function staffFitBands(histogram: readonly number[], strongFloor: number): { bands: FitBand[]; strong: number | null } {
  const split = strongFloor / BUCKET;
  const sum = (xs: readonly number[]) => xs.reduce((total, n) => total + n, 0);
  const lower = histogram.slice(0, split);
  const upper = histogram.slice(split);
  if (isSmallCount(sum(lower)) || isSmallCount(sum(upper))) return { bands: mergeSegment(histogram, 0), strong: null };
  return { bands: [...mergeSegment(lower, 0), ...mergeSegment(upper, split)], strong: sum(upper) };
}
