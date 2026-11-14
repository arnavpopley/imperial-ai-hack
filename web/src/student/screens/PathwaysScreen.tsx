// Screen 6: up to three career pathways with progress and the next-best module (spec 9.4),
// plus societies matched from the same profile (top five and one wildcard).
import type { Pathway, Society, SocietyMatch } from '@modulematch/shared';
import { Link } from 'react-router';
import { api } from '../../api.ts';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { FitScore } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Meter } from '../../components/Meter.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { percent, skillLabel } from '../labels.ts';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useModuleTitle, useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

const MAX_PATHWAYS = 3;
const TOP_SOCIETIES = 5;

export function PathwaysScreen() {
  const { session } = useReadySession();
  const { pathways } = useReferenceData();
  const { save, saving, error } = useProfileActions();
  const selected = session.profile.pathways;

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
    void save({ pathways: next, pathwaysSkipped: false });
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pathways</h1>
          <p className="mt-1 text-sm text-muted">
            Pick up to three directions. Your career weighting and next-best modules follow from them.
          </p>
        </div>
        <SampleDataLabel variant="pathways" />
      </header>

      <section aria-labelledby="choose-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="choose-heading" className="text-sm font-semibold">
            Choose your pathways{' '}
            <span className="font-normal text-muted tabular-nums">
              ({selected.length} of {MAX_PATHWAYS})
            </span>
          </h2>
          {selected.length === 0 && !session.profile.pathwaysSkipped && (
            <Button size="sm" variant="ghost" busy={saving} onClick={() => void save({ pathways: [], pathwaysSkipped: true })}>
              Not sure yet, skip
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mb-3 text-[13px] text-fit-low">
            Could not save your pathways: {error}
          </p>
        )}
        {pathways.data ? (
          pathways.data.length === 0 ? (
            <EmptyState icon="compass" title="No pathways available yet" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pathways.data.map((p) => {
                const on = selected.includes(p.id);
                const full = !on && selected.length >= MAX_PATHWAYS;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={full || saving}
                      onClick={() => toggle(p.id)}
                      className={cx(
                        'flex h-full w-full flex-col gap-1.5 rounded-card border p-4 text-left transition disabled:cursor-not-allowed',
                        on
                          ? 'border-brand bg-brand-soft/60 shadow-soft'
                          : 'border-line bg-surface hover:border-line-strong hover:shadow-soft disabled:opacity-50',
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold tracking-tight">{p.title}</span>
                        <span
                          className={cx(
                            'grid size-5 shrink-0 place-items-center rounded-full border',
                            on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong',
                          )}
                          aria-hidden="true"
                        >
                          {on && <Icon name="check" size={12} />}
                        </span>
                      </span>
                      <span className="text-[13px] leading-snug text-muted">{p.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : pathways.error ? (
          <ErrorState message={pathways.error} onRetry={pathways.reload} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading pathways">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <section aria-labelledby="progress-heading" className="grid gap-3">
          <h2 id="progress-heading" className="text-sm font-semibold">
            Your progress
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {selected.map((id) => (
              <PathwayProgressCard key={id} pathwayId={id} pathway={pathways.data?.find((p) => p.id === id)} />
            ))}
          </div>
        </section>
      )}

      <SocietiesSection />
    </div>
  );
}

function PathwayProgressCard({ pathwayId, pathway }: { pathwayId: string; pathway: Pathway | undefined }) {
  const { session } = useReadySession();
  const moduleTitle = useModuleTitle();
  const sessionId = session.id;
  const progress = useAsync(
    () => api.pathwayProgress(sessionId, pathwayId),
    [sessionId, pathwayId, session.shortlist.join(',')],
  );
  const title = pathway?.title ?? pathwayId;

  return (
    <article aria-label={title} className="rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft">
      <h3 className="font-semibold tracking-tight">{title}</h3>
      {progress.data ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-muted">From completed and shortlisted modules</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{percent(progress.data.progress)}</span>
          </div>
          <Meter value={progress.data.progress} label={`Progress towards ${title}`} size="md" className="mt-2" />

          <h4 className="mt-5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">By skill</h4>
          <ul className="mt-2 grid gap-2.5">
            {[...progress.data.perSkill]
              .sort((a, b) => b.importance - a.importance)
              .map((s) => (
                <li key={s.skill}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium">{skillLabel(s.skill)}</span>
                    <span className="text-[12px] text-muted tabular-nums">
                      {percent(s.covered)} covered · importance {percent(s.importance)}
                    </span>
                  </div>
                  <Meter
                    value={s.covered}
                    label={`${skillLabel(s.skill)} covered`}
                    tone={s.covered >= 0.7 ? 'high' : s.covered >= 0.4 ? 'brand' : 'mid'}
                    className="mt-1"
                  />
                </li>
              ))}
          </ul>

          {progress.data.nextBest ? (
            <Link
              to={paths.module(progress.data.nextBest.moduleId)}
              className="group mt-5 flex items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/50 px-4 py-3 transition hover:bg-brand-soft"
            >
              <Icon name="sparkle" size={16} className="shrink-0 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Next best module</span>
                <span className="block truncate text-sm font-semibold">{moduleTitle(progress.data.nextBest.moduleId)}</span>
              </span>
              <span className="text-[13px] font-semibold text-brand tabular-nums">
                +{Math.round(progress.data.nextBest.gain * 100)} pts
              </span>
              <Icon name="arrow-right" size={15} className="text-brand transition group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <p className="mt-5 text-[13px] text-muted">No eligible module would add to this pathway right now.</p>
          )}
        </>
      ) : progress.error ? (
        <ErrorState className="mt-3" message={progress.error} onRetry={progress.reload} />
      ) : (
        <div className="mt-3 grid gap-2" role="status" aria-label={`Loading progress for ${title}`}>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {pathway && pathway.sampleOpportunities.length > 0 && (
        <>
          <h4 className="mt-5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Sample opportunities</h4>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {pathway.sampleOpportunities.map((o) => (
              <li key={o} className="rounded-full border border-line px-2.5 py-1 text-[12px]">
                {o}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function SocietiesSection() {
  const { session } = useReadySession();
  const sessionId = session.id;
  const matches = useAsync(() => api.societyMatches(sessionId), [sessionId, session.profile.updatedAt]);
  const societies = useAsync(api.societies, []);
  const byId = new Map((societies.data ?? []).map((s) => [s.id, s]));
  const ranked = [...(matches.data ?? [])].filter((m) => !m.wildcard).sort((a, b) => b.fit - a.fit).slice(0, TOP_SOCIETIES);
  const wildcard = matches.data?.find((m) => m.wildcard);

  return (
    <section aria-labelledby="societies-heading" className="grid gap-3">
      <div>
        <h2 id="societies-heading" className="text-sm font-semibold">
          Societies that match you
        </h2>
        <p className="text-[13px] text-muted">The same profile, matched against student societies. Plus one wildcard.</p>
      </div>
      {matches.data ? (
        matches.data.length === 0 ? (
          <EmptyState icon="user" title="No society matches yet">
            Tell the advisor more about what you enjoy outside your course.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ranked.map((m) => (
              <SocietyCard key={m.societyId} match={m} society={byId.get(m.societyId)} />
            ))}
            {wildcard && <SocietyCard match={wildcard} society={byId.get(wildcard.societyId)} />}
          </ul>
        )
      ) : matches.error ? (
        <ErrorState message={matches.error} onRetry={matches.reload} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3" role="status" aria-label="Loading societies">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
    </section>
  );
}

function SocietyCard({ match, society }: { match: SocietyMatch; society: Society | undefined }) {
  return (
    <li
      className={cx(
        'flex flex-col gap-2 rounded-card border p-4',
        match.wildcard ? 'border-mode-explain/40 bg-mode-explain/6' : 'border-line bg-surface shadow-soft',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {match.wildcard && (
            <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.08em] text-mode-explain uppercase">
              <Icon name="sparkle" size={11} />
              Wildcard
            </span>
          )}
          <p className="font-semibold tracking-tight">{society?.name ?? match.societyId}</p>
        </div>
        <FitScore value={match.fit} variant="compact" className="text-sm" />
      </div>
      <p className="text-[13px] leading-snug text-muted">{match.reason}</p>
      {society && (
        <a
          href={society.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex items-center gap-1 text-[12px] font-medium text-brand underline-offset-2 hover:underline"
        >
          Union listing
          <Icon name="external" size={12} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}
