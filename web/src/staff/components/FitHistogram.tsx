// Fit distribution across the synthetic cohort: ten 10-point buckets from StaffModuleSummary.fitHistogram.
import { niceCeiling, percent, plural } from '../lib/format.ts';

const bucketLabel = (i: number) => (i === 9 ? '90–100' : `${i * 10}–${i * 10 + 9}`);

/** Fit at or above this counts as a strong fit in the summary line. */
const STRONG_FIT_BUCKET = 7;

export function FitHistogram({ buckets, averageFit }: { buckets: readonly number[]; averageFit: number }) {
  const total = buckets.reduce((sum, n) => sum + n, 0);
  const top = niceCeiling(Math.max(...buckets, 1));
  const ticks = [top, top / 2, 0];
  const strong = buckets.slice(STRONG_FIT_BUCKET).reduce((sum, n) => sum + n, 0);
  const peak = buckets.indexOf(Math.max(...buckets));
  const summary =
    total === 0
      ? 'No students scored yet.'
      : `${plural(total, 'student')} scored. Most common fit ${bucketLabel(peak)}. ` +
        `${percent(strong / total)} score 70 or above. Average fit ${Math.round(averageFit)}.`;

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
              {buckets.map((n, i) => (
                <div key={i} className="group relative flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-brand/80 transition-colors group-hover:bg-brand"
                    style={{ height: `${(n / top) * 100}%`, minHeight: n > 0 ? 2 : 0 }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-sm group-hover:block"
                  >
                    <span className="font-medium tabular-nums">{n}</span>{' '}
                    <span className="text-muted">at fit {bucketLabel(i)}</span>
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
      <figcaption className="mt-3 text-xs text-muted">Students per fit band (0–100). {summary}</figcaption>
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
            {buckets.map((n, i) => (
              <tr key={i} className="border-t border-line">
                <th scope="row" className="py-1 font-normal">
                  {bucketLabel(i)}
                </th>
                <td className="py-1 text-right">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
