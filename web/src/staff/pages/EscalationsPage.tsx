// Screen 11: the live escalation queue (polled every 5 seconds) with filters and a detail pane.
import type { EscalationStatus, EscalationType, StaffEscalation } from '@modulematch/shared';
import { useMemo, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router';
import { ESCALATION_TYPES, StatusBadge, TypeBadge } from '../components/EscalationBadges.tsx';
import { EmptyState, ErrorState, LoadingState, Segmented } from '../components/ui.tsx';
import { InboxIcon } from '../components/icons.tsx';
import { ESCALATION_POLL_MS } from '../hooks/useEscalationQueue.ts';
import { focusRing, formatClock, formatDateTime, formatRelative, plural } from '../lib/format.ts';
import { useStaffData } from '../StaffData.tsx';

type QueueFilter = 'all' | EscalationType;
type StatusFilter = 'unresolved' | 'all' | EscalationStatus;

const TYPES = Object.keys(ESCALATION_TYPES) as EscalationType[];

const STATUS_FILTERS: { value: StatusFilter; label: string; test: (s: EscalationStatus) => boolean }[] = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'unresolved', label: 'Unresolved', test: (s) => s !== 'resolved' },
  { value: 'open', label: 'Open', test: (s) => s === 'open' },
  { value: 'claimed', label: 'Claimed', test: (s) => s === 'claimed' },
  { value: 'resolved', label: 'Resolved', test: (s) => s === 'resolved' },
];

/** Unresolved first, then newest first. */
const byUrgency = (a: StaffEscalation, b: StaffEscalation) =>
  Number(a.status === 'resolved') - Number(b.status === 'resolved') || b.createdAt.localeCompare(a.createdAt);

export function EscalationsPage() {
  const { queue } = useStaffData();
  const { escalationId } = useParams();
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const items = queue.items;
  const statusTest = STATUS_FILTERS.find((f) => f.value === statusFilter)?.test ?? (() => true);

  const visible = useMemo(
    () =>
      (items ?? [])
        .filter((e) => (queueFilter === 'all' || e.type === queueFilter) && statusTest(e.status))
        .sort(byUrgency),
    [items, queueFilter, statusTest],
  );

  const queueOptions = useMemo(() => {
    const matching = (items ?? []).filter((e) => statusTest(e.status));
    return [
      { value: 'all' as const, label: 'All queues', count: matching.length },
      ...TYPES.map((t) => ({
        value: t,
        label: ESCALATION_TYPES[t].queue,
        count: matching.filter((e) => e.type === t).length,
      })),
    ];
  }, [items, statusTest]);

  return (
    <div className="grid grid-cols-1 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Cases the agents will not decide alone. Your reply goes straight back into the student's session.
          </p>
        </div>
        <LiveIndicator />
      </header>

      {items === null && queue.error === null && <LoadingState label="Loading escalations" rows={3} />}
      {queue.error && (
        <ErrorState
          title={items === null ? 'Could not load escalations' : 'Live updates paused: the last refresh failed'}
          error={queue.error}
          onRetry={queue.retry}
        />
      )}

      {items !== null && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <section aria-label="Queue" className={`grid gap-4 ${escalationId ? 'hidden lg:grid' : ''}`}>
            <div className="grid gap-3 rounded-card border border-line bg-surface p-4">
              <Segmented
                legend="Queue"
                name="queue-filter"
                value={queueFilter}
                options={queueOptions}
                onChange={setQueueFilter}
              />
              <Segmented
                legend="Status"
                name="status-filter"
                value={statusFilter}
                options={STATUS_FILTERS}
                onChange={setStatusFilter}
              />
            </div>
            {visible.length === 0 ? (
              <EmptyState icon={<InboxIcon className="size-6" />} title="Nothing in this view">
                {items.length === 0 ? 'No escalations yet. New ones appear here within 5 seconds.' : 'Try another filter.'}
              </EmptyState>
            ) : (
              <ul className="grid gap-2" aria-label={`${plural(visible.length, 'escalation')}`}>
                {visible.map((e) => (
                  <li key={e.id}>
                    <QueueItem escalation={e} fresh={queue.freshIds.has(e.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="min-w-0 lg:sticky lg:top-20">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  );
}

function LiveIndicator() {
  const { queue } = useStaffData();
  const fresh = queue.freshIds.size;
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden="true" className="relative flex size-2">
        {!queue.error && <span className="absolute inline-flex size-full animate-ping rounded-full bg-fit-high/60" />}
        <span className={`relative inline-flex size-2 rounded-full ${queue.error ? 'bg-fit-low' : 'bg-fit-high'}`} />
      </span>
      <span>
        {queue.lastUpdated
          ? `Live, refreshes every ${ESCALATION_POLL_MS / 1000} s. Updated ${formatClock(queue.lastUpdated)}`
          : 'Connecting…'}
      </span>
      <span className="sr-only" aria-live="polite">
        {fresh > 0 ? `${plural(fresh, 'new escalation')} arrived` : ''}
      </span>
    </div>
  );
}

function QueueItem({ escalation: e, fresh }: { escalation: StaffEscalation; fresh: boolean }) {
  return (
    <NavLink
      to={`/staff/escalations/${encodeURIComponent(e.id)}`}
      className={({ isActive }) =>
        `grid gap-2 rounded-card border p-3.5 transition-colors ${
          isActive ? 'border-brand bg-brand-soft/60' : 'border-line bg-surface hover:border-muted/50'
        } ${focusRing}`
      }
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={e.type} />
        <StatusBadge status={e.status} />
        {fresh && (
          <span className="rounded-full bg-fit-mid px-1.5 py-0.5 text-[11px] font-semibold text-surface">New</span>
        )}
        <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)} className="ml-auto text-xs text-muted">
          {formatRelative(e.createdAt)}
        </time>
      </span>
      <span className="line-clamp-2 text-sm">{e.summary}</span>
      <span className="text-xs text-muted">
        {e.studentContext.programme}, Year {e.studentContext.yearOfStudy}
      </span>
    </NavLink>
  );
}

export function EscalationPlaceholder() {
  return (
    <div className="hidden lg:block">
      <EmptyState icon={<InboxIcon className="size-6" />} title="Select an escalation">
        Its summary, the student's context and a reply box open here.
      </EmptyState>
    </div>
  );
}
