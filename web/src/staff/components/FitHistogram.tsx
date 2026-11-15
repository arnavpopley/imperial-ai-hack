// Fit distribution across the synthetic cohort, from StaffModuleSummary.fitBands. The server merges any band of one
// to four students with its neighbours (spec 20.4), so a band can be wider than 10 points: it is drawn as wide as it
// is, at its students per 10 points, so a merged band never looks taller than it is.
import { MIN_COHORT, STRONG_FIT_FLOOR } from '@modulematch/shared';
import type { StaffModuleSummary } from '@modulematch/shared';
import { niceCeiling, percent, plural } from '../lib/format.ts';

type Band = StaffModuleSummary['fitBands'][number];

const BAND_POINTS = 10;
const width = (b: Band) => b.to - b.from + 1;
const merged = (b: Band) => width(b) > BAND_POINTS + 1;
/** Students per 10 points of fit: a band's own count when it is 10 points wide. */
const density = (b: Band) => (b.students * BAND_POINTS) / Math.max(BAND_POINTS, width(b) - (b.to === 100 ? 1 : 0));
export const bandLabel = (b: Band) => `${b.from}–${b.to}`;

interface FitHistogramProps {
  bands: readonly Band[];
  averageFit: number;
  /** Students scored. */
  cohortSize: number;
  /** Share with a fit of STRONG_FIT_FLOOR or more, from the server's exact counts; null when it is withheld. */
  strongFitShare: number | null;
}

export function FitHistogram({ bands, averageFit, cohortSize, strongFitShare }: FitHistogramProps) {
  const top = niceCeiling(Math.max(...bands.map(density), 1));
  const ticks = [top, top / 2, 0];
  const peak = bands.reduce((best, b) => (density(b) > density(best) ? b : best), bands[0]!);
  const anyMerged = bands.some(merged);
  const strong =
    strongFitShare === null
      ? `The share scoring ${STRONG_FIT_FLOOR} or above is withheld: fewer than ${MIN_COHORT} students sit on one side of it.`
      : `${percent(strongFitShare)} score ${STRONG_FIT_FLOOR} or above.`;
  const summary =
    cohortSize === 0
      ? 'No students scored yet.'
      : `${plural(cohortSize, 'student')} scored. Most common fit ${bandLabel(peak)}. ` +
        `${strong} Average fit ${Math.round(averageFit)}.` +
        (anyMerged ? ` Bands with fewer than ${MIN_COHORT} students are merged with their neighbours.` : '');

  return (
    <figure>
      <div className="mt-6 flex gap-2">
        {/* y axis */}
        <div
          aria-hidden="true"
          className="flex h-44 flex-col justify-between text-right text-2xs text-muted tabular-nums"
        >
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div role="img" aria-label={`Fit distribution histogram. ${summary}`} className="relative h-44">
            {/* recessive gridlines */}
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
              {ticks.map((t) => (
                <div key={t} className={t === 0 ? 'border-t border-ink/40' : 'border-t border-dashed border-line'} />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end gap-0.5 sm:gap-1">
              {bands.map((b) => (
                <div key={b.from} className="group relative flex h-full items-end" style={{ flexGrow: width(b), flexBasis: 0 }}>
                  <div
                    className={`w-full rounded-t-[4px] transition-colors ${
                      merged(b) ? 'bg-brand/55 group-hover:bg-brand/75' : 'bg-brand/80 group-hover:bg-brand'
                    }`}
                    style={{ height: `${(density(b) / top) * 100}%`, minHeight: b.students > 0 ? 2 : 0 }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-sm group-hover:block"
                  >
                    <span className="font-medium tabular-nums">{b.students}</span>{' '}
                    <span className="text-muted">
                      at fit {bandLabel(b)}
                      {merged(b) ? ' (merged)' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* average marker */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 bottom-0 border-l-2 border-dotted border-ink/70"
              style={{ left: `${Math.min(100, Math.max(0, averageFit))}%` }}
            >
              <span className="absolute top-0 left-1 px-1 text-2xs leading-4 font-medium whitespace-nowrap">
                avg {Math.round(averageFit)}
              </span>
            </div>
          </div>
          <div aria-hidden="true" className="mt-1.5 flex justify-between text-2xs text-muted tabular-nums">
            {[0, 20, 40, 60, 80, 100].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted">
        Students per 10 points of fit (0–100). {summary}
      </figcaption>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer py-1 text-muted hover:text-ink">Show as table</summary>
        <table className="mt-2 w-full max-w-xs text-left tabular-nums">
          <caption className="sr-only">Students per fit band</caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Fit band
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Students
              </th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.from} className="border-t border-line">
                <th scope="row" className="py-1 font-normal">
                  {bandLabel(b)}
                  {merged(b) && <span className="text-muted"> (merged)</span>}
                </th>
                <td className="py-1 text-right">{b.students}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {anyMerged && (
          <p className="mt-1.5 text-muted">
            Merged: neighbouring bands with fewer than {MIN_COHORT} students are combined until each holds {MIN_COHORT}{' '}
            or more, to keep individuals unidentifiable.
          </p>
        )}
      </details>
    </figure>
  );
}
