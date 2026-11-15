// Screen 11: the live escalation queue (polled every 5 seconds) with filters and a detail pane.
import type { EscalationStatus, EscalationType, StaffEscalation } from '@modulematch/shared';
import { useEffect, useId, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { escalationTitle } from '../../components/escalationTitle.ts';
import { ESCALATION_TYPES, StatusBadge, TypeBadge } from '../components/EscalationBadges.tsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews.tsx';
import { ESCALATION_POLL_MS } from '../hooks/useEscalationQueue.ts';
import { useModuleLookup } from '../hooks/useModuleLookup.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { focusRing, formatClock, formatDateTime, formatRelative, plural } from '../lib/format.ts';
import { useStaffData } from '../StaffData.tsx';
import { Select } from '../../components/Select.tsx';

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

/** Wide enough for the queue and the detail side by side (Tailwind's lg). */
const DESKTOP = '(min-width: 1024px)';

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia?.(DESKTOP).matches === true;

export function EscalationsPage() {
  const { queue } = useStaffData();
  const { escalationId } = useParams();
  const navigate = useNavigate();
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

  // Issue 107: on a desktop the newest open request opens by itself, so it is the first thing staff see (demo
  // step 6). On a phone the queue stays in front, as the detail replaces it there.
  const firstOpen = visible.find((e) => e.status !== 'resolved');
  useEffect(() => {
    if (!escalationId && firstOpen && isDesktop()) {
      void navigate(`/staff/escalations/${encodeURIComponent(firstOpen.id)}`, { replace: true });
    }
  }, [escalationId, firstOpen, navigate]);

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
    <div className="grid grid-cols-1 gap-4">
      {/* The tab already names the page, so the heading is for screen readers and the live status joins the filters. */}
      <h2 className="sr-only">Escalations: questions the AI will not decide alone</h2>

      {items === null && queue.error === null && <LoadingState label="Loading escalations" />}
      {queue.error && (
        <ErrorState
          title={items === null ? 'Could not load escalations' : 'Live updates paused: the last refresh failed'}
          message={queue.error.message}
          onRetry={queue.retry}
        />
      )}

      {items !== null && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <section aria-label="Queue" className={`grid min-w-0 gap-3 ${escalationId ? 'hidden lg:grid' : ''}`}>
            {/* One row of filters, so the queue itself starts near the top (issue 107). */}
            <div className="grid gap-2 rounded-panel bg-surface p-3 shadow-soft ring-1 ring-line">
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  label="Queue"
                  value={queueFilter}
                  options={queueOptions.map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))}
                  onChange={setQueueFilter}
                />
                <FilterSelect label="Status" value={statusFilter} options={STATUS_FILTERS} onChange={setStatusFilter} />
              </div>
              <LiveIndicator />
            </div>
            {visible.length === 0 ? (
              <EmptyState icon="inbox" title="Nothing in this view">
                {items.length === 0
                  ? 'No escalations yet. New ones appear here within 5 seconds.'
                  : 'Try another filter.'}
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
          {/*
            The pane ends at the bottom of the first screen (it starts about 15rem down), and its reply form sticks to the
            pane's bottom edge, so the decision is in view without scrolling the page, at 1280x720 as at 1440x900.
          */}
          <div className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-panel">
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

/** A compact labelled select, so both filters sit in one row. */
function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    // A basis wide enough for "All queues (12)", so the filters wrap to two rows rather than truncate.
    <span className="flex min-w-0 flex-1 basis-52 items-center gap-2">
      <label htmlFor={id} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(ev) => onChange(ev.target.value as T)}
        wrapperClassName="flex-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </span>
  );
}

function QueueItem({ escalation: e, fresh }: { escalation: StaffEscalation; fresh: boolean }) {
  const { moduleByIdForTitle } = useModuleLookup();
  return (
    <NavLink
      to={`/staff/escalations/${encodeURIComponent(e.id)}`}
      className={({ isActive }) =>
        `grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-panel p-4 shadow-soft ring-1 transition-[box-shadow,background-color] hover:shadow-lift ${
          isActive ? 'bg-brand-soft/70 ring-brand/40' : 'bg-surface ring-line'
        } ${focusRing}`
      }
    >
      <Avatar seed={e.sessionId} size={36} />
      <span className="grid min-w-0 gap-1.5">
        {/* Issue 107: the module and the kind of request, so two requests never look alike. */}
        <span className="flex items-start gap-2">
          <span className="min-w-0 text-sm leading-snug font-semibold">{escalationTitle(e, moduleByIdForTitle)}</span>
          {fresh && (
            <span className="shrink-0 rounded-full bg-fit-mid px-2 py-0.5 text-2xs font-semibold text-surface">New</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>
            {e.studentContext.programme}, Year {e.studentContext.yearOfStudy}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)}>
            {formatRelative(e.createdAt)}
          </time>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <TypeBadge type={e.type} />
          <StatusBadge status={e.status} />
        </span>
      </span>
    </NavLink>
  );
}

export function EscalationPlaceholder() {
  return (
    // Inset, so the scroll pane's larger rounded corners never clip the dashed outline.
    <div className="hidden lg:block lg:p-1">
      <EmptyState icon="inbox" title="Pick a question from the queue">
        You will see what the student asked, their context, and a box to reply.
      </EmptyState>
    </div>
  );
}
