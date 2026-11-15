// Demand against capacity (spec 9.3 DEMAND): a bar that turns amber near capacity and red once over it.
import { MIN_COHORT } from '@modulematch/shared';
import { CAPACITY_LABEL, NEAR_CAPACITY, capacityStatus, percent } from '../lib/format.ts';
import type { CapacityStatus } from '../lib/format.ts';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { InfoTip } from '../../components/InfoTip.tsx';

const tone: Record<CapacityStatus, { bar: string; badge: BadgeTone }> = {
  uncapped: { bar: 'bg-brand', badge: 'brand' },
  within: { bar: 'bg-fit-high', badge: 'success' },
  near: { bar: 'bg-fit-mid', badge: 'warning' },
  over: { bar: 'bg-fit-low', badge: 'danger' },
};

function CapacityChip({ status }: { status: CapacityStatus }) {
  return (
    <Badge tone={tone[status].badge} size="md" icon={status === 'near' || status === 'over' ? 'alert' : 'check'}>
      {CAPACITY_LABEL[status]}
    </Badge>
  );
}

/** Demand from fewer than MIN_COHORT students: no number, no share of capacity, just the band. */
function WithheldDemand({ capacity }: { capacity: number | null }) {
  return (
    <div>
      <p className="text-sm">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">Fewer than {MIN_COHORT}</span>{' '}
        <span className="text-muted">{capacity === null ? 'students shortlisted' : `of ${capacity} places shortlisted`}</span>
      </p>
      <div aria-hidden="true" className="relative mt-3 h-3 rounded-full bg-line/70">
        <div className="hatch h-full w-3 rounded-full text-line-strong" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Counts of 1 to {MIN_COHORT - 1} students are withheld, to keep individuals unidentifiable.
      </p>
    </div>
  );
}

/** Compact bar for list rows. Decorative: the row's text carries the numbers. */
export function DemandMiniBar({ shortlisted, capacity }: { shortlisted: number; capacity: number | null }) {
  const status = capacityStatus(shortlisted, capacity);
  const fill = capacity === null ? 0 : Math.min(1, shortlisted / capacity);
  return (
    <span aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full bg-line">
      <span className={`block h-full rounded-full ${tone[status].bar}`} style={{ width: percent(fill) }} />
    </span>
  );
}

/**
 * Shortlists against capacity. `shortlisted` is null when the server withheld a count of one to four students
 * (spec 20.4): the gauge then says "fewer than 5" and draws a hatched stub instead of a bar.
 */
export function DemandGauge({ shortlisted, capacity }: { shortlisted: number | null; capacity: number | null }) {
  if (shortlisted === null) return <WithheldDemand capacity={capacity} />;
  const status = capacityStatus(shortlisted, capacity);
  // When demand exceeds capacity the scale stretches to the demand, and a marker shows where capacity sits.
  const scale = capacity === null ? Math.max(shortlisted, 1) : Math.max(capacity, shortlisted);
  const fill = shortlisted / scale;
  const capacityAt = capacity === null ? null : capacity / scale;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{shortlisted}</span>{' '}
          <span className="text-muted">
            {capacity === null ? 'students shortlisted' : `of ${capacity} places shortlisted`}
          </span>
        </p>
        <CapacityChip status={status} />
      </div>
      <div aria-hidden="true" className="relative mt-3 h-3 rounded-full bg-line/70">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tone[status].bar}`}
          style={{ width: percent(fill) }}
        />
        {capacityAt !== null && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink"
            style={{ left: `calc(${percent(capacityAt)} - 1px)` }}
          />
        )}
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
        {capacity === null ? 'This module has no capacity limit.' : `${percent(shortlisted / capacity)} of capacity.`}
        {capacity !== null && (
          <InfoTip label="About the capacity colours">
            The bar turns amber at {percent(NEAR_CAPACITY)} of capacity and red above 100%.
          </InfoTip>
        )}
      </p>
    </div>
  );
}
