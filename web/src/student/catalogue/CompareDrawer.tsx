// Two or three modules side by side (issue 62). Fit and sub-scores come from the student's live ranking, so they
// match the cards; assessment, load, topics, prerequisites, timetable and clashes come from the module records
// and the timetable engine. No model is called.
import type { CompareModule } from '@modulematch/shared';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.ts';
import { Button } from '../../components/Button.tsx';
import { ClashMarker } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { Drawer } from '../../components/Drawer.tsx';
import { FIT_BAND_METER, FIT_BAND_TEXT, fitBand } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Meter, type MeterTone } from '../../components/Meter.tsx';
import { ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { SubScoreBars } from '../../components/SubScoreBars.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { TERM_LABELS } from '../labels.ts';
import { paths } from '../routes.ts';
import type { RankedModule } from '../state/CatalogueProvider.tsx';
import { advisorPrompt, COMPARE_DOT, COMPARE_LETTERS, timetableLines } from './compare.ts';

interface CompareDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  /** The selected modules, in selection order. */
  moduleIds: readonly string[];
  /** The live ranking, for fit, sub-scores and eligibility. */
  byId: ReadonlyMap<string, RankedModule>;
  /** False while there is nothing to score yet: no fit numbers are shown. */
  scored: boolean;
  /** Low profile confidence greys every score, as on the cards (spec 8.6). */
  lowConfidence: boolean;
  isShortlisted: (moduleId: string) => boolean;
  /** Changes whenever the shortlist does, so the clashes are fetched again while the drawer is open. */
  shortlistKey: string;
  onAsk: (question: string) => void;
}


export function CompareDrawer(props: CompareDrawerProps) {
  const { open, onClose, sessionId, moduleIds, shortlistKey, onAsk } = props;
  const key = moduleIds.join(',');
  const view = useAsync(() => api.compare(sessionId, moduleIds), [sessionId, key, shortlistKey], open && moduleIds.length >= 2);
  const modules = view.data?.modules.filter((m) => moduleIds.includes(m.moduleId)) ?? [];
  // Only a successful, finished fetch is shown: after a failed refresh the old clashes may be out of date.
  const current = modules.length === moduleIds.length && !view.loading && !view.error;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title="Compare modules"
      subtitle="Fit from your ranking. Everything else from the module records and the timetable."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted">Numbers come from code, not a model.</p>
          <Button
            variant="primary"
            icon="chat"
            disabled={!current}
            onClick={() => {
              onClose();
              onAsk(advisorPrompt(modules.map((m) => m.code)));
            }}
          >
            Ask the advisor which suits me
          </Button>
        </div>
      }
    >
      <div className="h-full overflow-y-auto overscroll-contain px-5 pb-6">
        {view.error ? (
          <div className="py-6">
            <ErrorState message={view.error} onRetry={view.reload} />
          </div>
        ) : !current ? (
          <CompareSkeleton columns={moduleIds.length} />
        ) : (
          <CompareTable {...props} modules={modules} />
        )}
      </div>
    </Drawer>
  );
}

function CompareTable({ modules, byId, scored, lowConfidence, isShortlisted }: CompareDrawerProps & { modules: CompareModule[] }) {
  const fits = modules.map((m) => byId.get(m.moduleId)?.fit ?? null);
  const best = scored ? Math.max(...fits.map((f) => f ?? -1)) : -1;
  const bestIsUnique = fits.filter((f) => f === best).length === 1;

  const row = (label: string, render: (m: CompareModule, i: number) => ReactNode) => (
    <Row label={label} modules={modules} render={render} />
  );

  return (
    <>
      {/* The column heads: a legend on a phone (each row repeats the letters), sticky column titles from sm up. */}
      <ol
        className={cx(
          'z-10 -mx-5 grid gap-2 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur sm:sticky sm:top-0 sm:gap-4',
          modules.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {modules.map((m, i) => {
          const ranked = byId.get(m.moduleId);
          return (
            <li key={m.moduleId} className="flex min-w-0 items-start gap-2">
              <Letter index={i} />
              <div className="min-w-0">
                <Link to={paths.module(m.moduleId)} className="block truncate text-[14px] leading-snug font-semibold hover:underline sm:whitespace-normal">
                  {m.title}
                </Link>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
                  <span className="font-mono">{m.code}</span>
                  {isShortlisted(m.moduleId) && <span className="font-semibold text-brand">· Shortlisted</span>}
                  {ranked && !ranked.eligible && (
                    <span className="inline-flex items-center gap-0.5 font-semibold">
                      · <Icon name="lock" size={11} /> Not eligible yet
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {row('Fit for you', (m) => {
        const ranked = byId.get(m.moduleId);
        if (!scored || !ranked) return <p className="text-[13px] text-muted">No fit score yet: tell the interviewer what you enjoy.</p>;
        const band = fitBand(ranked.fit);
        return (
          <div className={cx('grid gap-2', lowConfidence && 'grayscale')}>
            <div className="flex items-baseline gap-2">
              <span className={cx('text-2xl leading-none font-semibold tabular-nums', FIT_BAND_TEXT[band])}>{ranked.fit}</span>
              <span className="text-[12px] text-muted">/ 100</span>
              {ranked.fit === best && bestIsUnique && (
                <span className="ml-auto rounded-md bg-fit-high/10 px-1.5 py-0.5 text-[11px] font-semibold text-fit-high">Best fit</span>
              )}
            </div>
            <Meter value={ranked.fit / 100} tone={FIT_BAND_METER[band]} label={`Fit for ${m.title}`} valueText={`${ranked.fit} out of 100`} />
            <SubScoreBars sub={ranked.sub} variant="compact" dimmed={lowConfidence} className="mt-1" />
          </div>
        );
      })}

      {row('Assessment', (m) => <AssessmentBar assessment={m.assessment} title={m.title} />)}

      {row('Load', (m) => (
        <dl className="grid gap-1.5">
          {(
            [
              ['Maths', m.mathsPercent],
              ['Coding', m.codingPercent],
              ['Workload', m.workloadPercent],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[4.5rem_1fr_2.25rem] items-center gap-2 text-[12px]">
              <dt className="text-muted">{label}</dt>
              <dd className="contents">
                <Meter value={value / 100} tone="brand" label={`${label} for ${m.title}`} />
                <span className="text-right tabular-nums">{value}%</span>
              </dd>
            </div>
          ))}
        </dl>
      ))}

      {row('Credits and term', (m) => (
        <p className="text-[13px]">
          <span className="font-semibold tabular-nums">{m.ects}</span> ECTS · {m.terms.map((t) => TERM_LABELS[t]).join(', ')}
        </p>
      ))}

      {row('Key topics', (m) =>
        m.topics.length ? (
          <ul className="flex flex-wrap gap-1">
            {m.topics.map((t) => (
              <li key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px]">
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">None tagged</p>
        ),
      )}

      {row('Prerequisites and eligibility', (m) => {
        const ranked = byId.get(m.moduleId);
        return (
          <div className="grid gap-1.5 text-[13px]">
            {m.prerequisites.length ? (
              <ul className="grid gap-0.5">
                {m.prerequisites.map((p) => (
                  <li key={p.moduleId}>
                    <span className="font-mono text-[12px]">{p.moduleId}</span> {p.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No prerequisites</p>
            )}
            {ranked?.eligible === false ? (
              <ul className="grid gap-0.5 text-fit-low">
                {ranked.ineligibleReasons.map((reason) => (
                  <li key={reason} className="flex gap-1">
                    <Icon name="lock" size={12} className="mt-0.5 shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-1 font-medium text-fit-high">
                <Icon name="check" size={13} /> {ranked?.compulsory ? 'Core, already in your plan' : 'Open to you'}
              </p>
            )}
          </div>
        );
      })}

      {row('Clashes with your plan', (m) =>
        m.clashes.length ? (
          <ul className="grid gap-1.5 text-[13px]">
            {m.clashes.map((c) => (
              <li key={`${c.withModuleId}-${c.term}`} className="grid gap-1">
                <ClashMarker variant={c.label} probability={c.probability} className="justify-self-start" />
                <span>
                  {TERM_LABELS[c.term]}: with <span className="font-mono text-[12px]">{c.withModuleId}</span> {c.withTitle}
                  {c.core && <span className="text-muted"> (core)</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-1 text-[13px] text-muted">
            <Icon name="check" size={13} className="mt-0.5 shrink-0 text-fit-high" /> No clashes with your shortlist or core modules
          </p>
        ),
      )}

      {row('Timetable', (m) => {
        const lines = timetableLines(m.slots);
        return lines.length ? (
          <ul className="grid gap-1 text-[12px]">
            {lines.map((line) => (
              <li key={line.term}>
                <span className="font-semibold">{line.term}</span>
                <span className="text-muted">: {line.times.join(' · ')}</span>
                {line.more > 0 && <span className="text-muted"> · +{line.more} more</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No times published yet</p>
        );
      })}
    </>
  );
}

/**
 * One attribute across the modules: side by side from sm up, one line per module on a phone. Each value starts
 * with its module's name for screen readers, since the letters and the column order are visual only.
 */
function Row({ label, modules, render }: { label: string; modules: CompareModule[]; render: (m: CompareModule, i: number) => ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-b border-line py-3.5 last:border-b-0">
      <h3 id={headingId} className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        {label}
      </h3>
      <ul className={cx('grid gap-3 sm:gap-4', modules.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {modules.map((m, i) => (
          <li key={m.moduleId} className="flex min-w-0 gap-2 sm:block">
            <span className="shrink-0 pt-0.5 sm:hidden">
              <Letter index={i} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="sr-only">
                {m.code} {m.title}:{' '}
              </span>
              {render(m, i)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Letter({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-md text-[11px] leading-none font-bold text-on-brand ${COMPARE_DOT[index]}`}>
      {COMPARE_LETTERS[index]}
    </span>
  );
}

/** Exam, coursework and practical as one stacked bar with a legend; "estimated" when the page publishes no split. */
function AssessmentBar({ assessment, title }: { assessment: CompareModule['assessment']; title: string }) {
  const parts = [
    { label: 'Exam', value: assessment.exam, className: 'bg-brand' },
    { label: 'Coursework', value: assessment.coursework, className: 'bg-module-2' },
    { label: 'Practical', value: assessment.practical, className: 'bg-module-3' },
  ].filter((p) => p.value > 0);
  const summary = parts.map((p) => `${p.label} ${p.value}%`).join(', ');
  return (
    <div className="grid gap-1.5">
      <div role="img" aria-label={`Assessment for ${title}: ${summary}${assessment.source === 'estimated' ? ', estimated' : ''}`} className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p) => (
          <span key={p.label} className={p.className} style={{ width: `${p.value}%` }} />
        ))}
      </div>
      <p aria-hidden="true" className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[12px]">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1">
            <span className={`size-2 rounded-full ${p.className}`} />
            {p.label} <span className="font-semibold tabular-nums">{p.value}%</span>
          </span>
        ))}
        {assessment.source === 'estimated' && <span className="text-muted">(estimated)</span>}
      </p>
    </div>
  );
}

function CompareSkeleton({ columns }: { columns: number }) {
  return (
    <div role="status" aria-label="Loading the comparison" className={cx('grid gap-4 py-4', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-5/6" />
          <Skeleton className="h-2 w-4/6" />
        </div>
      ))}
    </div>
  );
}
