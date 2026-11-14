// Screen 6: up to three career pathways with progress and the next-best module (spec 9.4),
// plus societies matched from the same profile (top five and one wildcard).
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { PhotoBanner } from '../catalogue/PhotoBanner.tsx';
import { PathwayIcon } from '../pathways/PathwayIcon.tsx';
import { PathwayProgressCard } from '../pathways/PathwayProgressCard.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { SocietiesSection } from '../societies/SocietiesSection.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

const MAX_PATHWAYS = 3;

export function PathwaysScreen() {
  const { session } = useReadySession();
  const { pathways } = useReferenceData();
  const { save, saving, error } = useProfileActions();
  const reduce = useReducedMotion();
  const selected = session.profile.pathways;

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
    void save({ pathways: next, pathwaysSkipped: false });
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <PhotoBanner
        image="pathways-graduation"
        alt="Graduates in caps and gowns celebrating"
        title="Pathways"
        subtitle="Pick up to three directions. Your career weighting and next-best modules follow from them."
        aside={<SampleDataLabel variant="pathways" />}
        focus="center 30%"
      />

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
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {pathways.data.map((p, i) => {
                const on = selected.includes(p.id);
                const full = !on && selected.length >= MAX_PATHWAYS;
                return (
                  <motion.li
                    key={p.id}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  >
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={full || saving}
                      onClick={() => toggle(p.id)}
                      title={full ? `You can choose up to ${MAX_PATHWAYS} pathways` : undefined}
                      className={cx(
                        'group flex h-full w-full items-start gap-3 rounded-card border p-4 text-left transition disabled:cursor-not-allowed',
                        on
                          ? 'border-brand bg-brand-soft/60 shadow-soft'
                          : 'border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-soft disabled:opacity-50 disabled:hover:translate-y-0',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
                          on ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted group-hover:text-brand',
                        )}
                      >
                        <PathwayIcon pathwayId={p.id} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-semibold tracking-tight">{p.title}</span>
                          {on && <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand" />}
                        </span>
                        <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted">{p.description}</span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )
        ) : pathways.error ? (
          <ErrorState message={pathways.error} onRetry={pathways.reload} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading pathways">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <section aria-labelledby="progress-heading" className="grid gap-3">
          <h2 id="progress-heading" className="text-sm font-semibold">
            Your progress
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {selected.map((id, i) => (
              <PathwayProgressCard key={id} pathwayId={id} pathway={pathways.data?.find((p) => p.id === id)} index={i} />
            ))}
          </div>
        </section>
      )}

      <SocietiesSection />
    </div>
  );
}
