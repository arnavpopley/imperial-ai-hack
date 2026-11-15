// Grouping, filtering and honest labels for the staff module list (issue #69).
import { MIN_COHORT, STRONG_FIT_FLOOR } from '@modulematch/shared';
import type { CohortOffer, StaffModuleSummary } from '@modulematch/shared';

export const OFFER_GROUPS: readonly { offer: CohortOffer; label: string }[] = [
  { offer: 'elective', label: 'Electives' },
  { offer: 'i-explore', label: 'I-Explore' },
  { offer: 'core', label: 'Compulsory' },
  { offer: 'not-offered', label: 'Not offered to this cohort' },
];

export type ListView = 'options' | 'core' | 'all';

export const VIEWS: readonly { value: ListView; label: string; offers: readonly CohortOffer[] }[] = [
  { value: 'options', label: 'Options', offers: ['elective', 'i-explore'] },
  { value: 'core', label: 'Core', offers: ['core'] },
  { value: 'all', label: 'All', offers: ['elective', 'i-explore', 'core', 'not-offered'] },
];

/** True when the server said how the cohort offers each module; older servers send no offer at all. */
export const hasOffers = (rows: readonly StaffModuleSummary[]) => rows.length > 0 && rows.every((r) => r.offer !== undefined);

export const inView = (row: StaffModuleSummary, view: ListView) =>
  row.offer === undefined || (VIEWS.find((v) => v.value === view)?.offers ?? []).includes(row.offer);

/** Students choose options, so only options show a shortlist count that means anything. */
export const isOption = (row: StaffModuleSummary) => row.offer === undefined || row.offer === 'elective' || row.offer === 'i-explore';

/** A fit at or above this counts as strong: the 60 to 100 buckets of the fit histogram. */
export const STRONG_FIT = STRONG_FIT_FLOOR;

/**
 * Share of the cohort whose fit is strong, from the server's exact counts. It separates modules far better than
 * the mean, which sits at 25 to 42. Null (one to four students) sorts as none.
 */
export const strongFitShare = (row: StaffModuleSummary): number => row.strongFitShare ?? 0;

/**
 * The server withholds counts of one to four students (spec 20.4, null), so they are shown as a band, the same
 * five-student rule as every other staff figure, and a count of one or two never points at individual students.
 */
export function shortlistLabel(row: StaffModuleSummary): string {
  if (row.offer === 'core') return 'Compulsory for this cohort';
  if (row.offer === 'not-offered') return 'Not offered to this cohort';
  if (row.shortlisted === 0) return 'No shortlists yet';
  if (row.shortlisted === null || row.shortlisted < MIN_COHORT) return `Under ${MIN_COHORT} shortlisted`;
  return `${row.shortlisted}${row.capacity === null ? '' : ` / ${row.capacity}`} shortlisted`;
}

/** The shortlist count for sorting, with counts under MIN_COHORT banded together so their order reveals nothing. */
export const shortlistFigure = (row: StaffModuleSummary) =>
  row.shortlisted === null || row.shortlisted < MIN_COHORT ? 0 : row.shortlisted;

/** A shortlist count to compare against capacity: a withheld count (one to four) is too few to be near it. */
export const knownShortlisted = (row: Pick<StaffModuleSummary, 'shortlisted'>) => row.shortlisted ?? 0;

export interface ModuleGroup {
  offer: CohortOffer | null;
  label: string;
  rows: StaffModuleSummary[];
}

/** Rows grouped by offer in a fixed order, keeping the caller's sort within each group. */
export function groupRows(rows: readonly StaffModuleSummary[]): ModuleGroup[] {
  if (!hasOffers(rows)) return rows.length > 0 ? [{ offer: null, label: 'Modules', rows: [...rows] }] : [];
  return OFFER_GROUPS.map(({ offer, label }) => ({ offer, label, rows: rows.filter((r) => r.offer === offer) })).filter(
    (g) => g.rows.length > 0,
  );
}
