// Grouping, filtering and honest labels for the staff module list (issue #69).
import { MIN_COHORT } from '@modulematch/shared';
import type { StaffModuleSummary } from '@modulematch/shared';

/**
 * How the cohort's programme year offers a module. GET /staff/modules sends it beside each summary; it is
 * optional because the shared StaffModuleSummary schema does not list it yet.
 */
export type CohortOffer = 'elective' | 'i-explore' | 'core' | 'not-offered';

export type StaffModuleRow = StaffModuleSummary & { offer?: CohortOffer };

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
export const hasOffers = (rows: readonly StaffModuleRow[]) => rows.length > 0 && rows.every((r) => r.offer !== undefined);

export const inView = (row: StaffModuleRow, view: ListView) =>
  row.offer === undefined || (VIEWS.find((v) => v.value === view)?.offers ?? []).includes(row.offer);

/** Students choose options, so only options show a shortlist count that means anything. */
export const isOption = (row: StaffModuleRow) => row.offer === undefined || row.offer === 'elective' || row.offer === 'i-explore';

/** A fit at or above this counts as strong: the 60 to 100 buckets of the fit histogram. */
export const STRONG_FIT = 60;
const BUCKET_WIDTH = 10;

/** Share of the cohort whose fit is strong. It separates modules far better than the mean, which sits at 25 to 42. */
export function strongFitShare(row: StaffModuleSummary): number {
  const total = row.fitHistogram.reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;
  const strong = row.fitHistogram.slice(STRONG_FIT / BUCKET_WIDTH).reduce((sum, n) => sum + n, 0);
  return strong / total;
}

/**
 * Shortlist counts under MIN_COHORT are reported as a band, the same five-student rule as every other staff
 * figure, so a count of one or two never points at individual students.
 */
export function shortlistLabel(row: StaffModuleRow): string {
  if (row.offer === 'core') return 'Compulsory for this cohort';
  if (row.offer === 'not-offered') return 'Not offered to this cohort';
  if (row.shortlisted === 0) return 'No shortlists yet';
  if (row.shortlisted < MIN_COHORT) return `Under ${MIN_COHORT} shortlisted`;
  return `${row.shortlisted}${row.capacity === null ? '' : ` / ${row.capacity}`} shortlisted`;
}

/** The shortlist count for sorting, with counts under MIN_COHORT banded together so their order reveals nothing. */
export const shortlistFigure = (row: StaffModuleRow) => (row.shortlisted < MIN_COHORT ? 0 : row.shortlisted);

export interface ModuleGroup {
  offer: CohortOffer | null;
  label: string;
  rows: StaffModuleRow[];
}

/** Rows grouped by offer in a fixed order, keeping the caller's sort within each group. */
export function groupRows(rows: readonly StaffModuleRow[]): ModuleGroup[] {
  if (!hasOffers(rows)) return rows.length > 0 ? [{ offer: null, label: 'Modules', rows: [...rows] }] : [];
  return OFFER_GROUPS.map(({ offer, label }) => ({ offer, label, rows: rows.filter((r) => r.offer === offer) })).filter(
    (g) => g.rows.length > 0,
  );
}
