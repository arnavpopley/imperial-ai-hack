// A short summary of the module's public description with a few highlight chips (GET /modules/:id/summary).
// The label says where the text came from: a live model, or a template built from the module record.
import { motion, useReducedMotion } from 'motion/react';
import { api } from '../../api.ts';
import { Icon } from '../../components/Icon.tsx';
import { Button } from '../../components/Button.tsx';
import { Provenance } from '../../components/Provenance.tsx';
import { Skeleton } from '../../components/StateViews.tsx';
import { ClaimCheck } from '../claimcheck/ClaimCheck.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';

export function AiSummaryCard({ moduleId }: { moduleId: string }) {
  const summary = useAsync(() => api.moduleSummary(moduleId), [moduleId]);
  const reduce = useReducedMotion();
  const sourceUrl = useReferenceData().moduleById.get(moduleId)?.sourceUrl;
  // useAsync keeps the last value while a new module loads; never show another module's summary.
  const data = summary.data?.moduleId === moduleId ? summary.data : undefined;

  return (
    <section
      aria-labelledby="summary-heading"
      className="relative overflow-hidden rounded-[1.25rem] border border-brand/20 bg-surface p-5 shadow-soft sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-brand-soft opacity-70 blur-2xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="summary-heading" className="flex items-center gap-2 text-subheading">
            <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
              <Icon name="sparkle" size={14} />
            </span>
            In short
          </h2>
          {/* Written by the AI from the public description, or, offline, put together from the module record. */}
          {data && <Provenance kind={data.source === 'model' ? 'ai' : 'record'} />}
        </div>

        {data ? (
          <>
            <p className="mt-3 text-base leading-relaxed text-pretty sm:text-base">{data.summary}</p>
            {data.highlights.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Highlights">
                {data.highlights.slice(0, 4).map((h, i) => (
                  <motion.li
                    key={h}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.3 }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft/60 px-3 py-1.5 text-xs font-medium"
                  >
                    <Icon name="check" size={13} className="text-brand" />
                    {h}
                  </motion.li>
                ))}
              </ul>
            )}
            {sourceUrl && (
              <ClaimCheck
                className="mt-4"
                label="Check this summary"
                kind={data.source === 'model' ? 'summary' : 'summary-template'}
                text={[data.summary, ...data.highlights].join('\n')}
                sourceUrl={sourceUrl}
                storageKey={`${moduleId}.summary`}
              />
            )}
          </>
        ) : summary.error ? (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
            <Icon name="info" size={15} className="shrink-0 text-fit-mid" />
            <span className="min-w-0 flex-1">
              The summary is not available right now. The full description is under “About the module” below.
            </span>
            <Button size="sm" variant="ghost" icon="reset" onClick={summary.reload}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-2.5" role="status" aria-label="Summarising the module">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-full" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
