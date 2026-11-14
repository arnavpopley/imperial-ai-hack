// Societies matched from the same profile: the top five plus one wildcard, as a revolving bubble cloud
// with a detail panel, and as cards under a photo header.
import type { Society, SocietyMatch } from '@modulematch/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { api } from '../../api.ts';
import { cx } from '../../components/cx.ts';
import { FitScore } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useReadySession } from '../state/SessionProvider.tsx';
import { BubbleCloud, type CloudItem } from './BubbleCloud.tsx';
import { MAX_PER_RING } from './cloudLayout.ts';

const TOP_SOCIETIES = 5;

export function SocietiesSection() {
  const { session } = useReadySession();
  const sessionId = session.id;
  const matches = useAsync(() => api.societyMatches(sessionId), [sessionId, session.profile.updatedAt]);
  const societies = useAsync(api.societies, []);
  const [chosen, setChosen] = useState<string | null>(null);
  const detailId = useId();

  const byId = new Map((societies.data ?? []).map((s) => [s.id, s]));
  const ranked = [...(matches.data ?? [])].filter((m) => !m.wildcard).sort((a, b) => b.fit - a.fit).slice(0, TOP_SOCIETIES);
  const wildcard = matches.data?.find((m) => m.wildcard);
  const shown = wildcard ? [...ranked, wildcard] : ranked;
  const shownIds = new Set(shown.map((m) => m.societyId));
  const matchById = new Map((matches.data ?? []).map((m) => [m.societyId, m]));

  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const featured: CloudItem[] = shown.map((m) => ({ id: m.societyId, name: nameOf(m.societyId), fit: m.fit, wildcard: m.wildcard }));
  const others: CloudItem[] = (societies.data ?? [])
    .filter((s) => !shownIds.has(s.id))
    .slice(0, MAX_PER_RING)
    .map((s) => ({ id: s.id, name: s.name, fit: null, wildcard: false }));
  const selectedId = chosen ?? shown[0]?.societyId ?? null;

  return (
    <section aria-labelledby="societies-heading" className="grid gap-5">
      <header className="relative isolate overflow-hidden rounded-[1.25rem] border border-line shadow-soft">
        <img
          src="/images/societies-celebrating.jpg"
          alt="Friends celebrating together outdoors"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_35%]"
          decoding="async"
          loading="lazy"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[rgb(14_16_22/0.78)] to-[rgb(14_16_22/0.15)]" />
        <div className="max-w-lg px-5 py-6 text-white sm:px-7 sm:py-8">
          <h2 id="societies-heading" className="text-xl font-semibold tracking-tight">
            Societies that match you
          </h2>
          <p className="mt-1 text-sm text-white/85">
            The same profile, matched against student societies, plus one wildcard you might not have thought of.
          </p>
        </div>
      </header>

      {matches.data ? (
        matches.data.length === 0 ? (
          <EmptyState icon="user" title="No society matches yet">
            Tell the advisor more about what you enjoy outside your course.
          </EmptyState>
        ) : (
          <>
            <div className="grid items-center gap-5 overflow-hidden rounded-[1.25rem] border border-line bg-surface p-4 shadow-soft sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <BubbleCloud featured={featured} others={others} selectedId={selectedId} onSelect={setChosen} detailId={detailId} />
              <SocietyDetail
                id={detailId}
                society={selectedId ? byId.get(selectedId) : undefined}
                match={selectedId ? matchById.get(selectedId) : undefined}
              />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Matched societies">
              {shown.map((m, i) => (
                <SocietyCard key={m.societyId} match={m} society={byId.get(m.societyId)} index={i} />
              ))}
            </ul>
          </>
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

function SocietyDetail({ id, society, match }: { id: string; society: Society | undefined; match: SocietyMatch | undefined }) {
  const reduce = useReducedMotion();
  return (
    <div id={id} aria-live="polite" className="min-h-[11rem] rounded-2xl bg-surface-2 p-5">
      <AnimatePresence mode="wait" initial={false}>
        {society ? (
          <motion.div
            key={society.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {match?.wildcard && (
                  <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.08em] text-mode-explain uppercase">
                    <Icon name="sparkle" size={11} />
                    Wildcard
                  </span>
                )}
                <p className="font-semibold tracking-tight">{society.name}</p>
              </div>
              {match && <FitScore value={match.fit} variant="compact" className="text-sm" />}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{match?.reason ?? society.description}</p>
            <a
              href={society.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand underline-offset-2 hover:underline"
            >
              See it on the Union site
              <Icon name="external" size={13} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </motion.div>
        ) : (
          <motion.p key="empty" className="text-[13px] text-muted">
            Pick a bubble to see why it suits you.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocietyCard({ match, society, index }: { match: SocietyMatch; society: Society | undefined; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cx(
        'flex flex-col gap-2 rounded-card border p-4',
        match.wildcard ? 'border-dashed border-mode-explain/50 bg-mode-explain/6' : 'border-line bg-surface shadow-soft',
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
    </motion.li>
  );
}
