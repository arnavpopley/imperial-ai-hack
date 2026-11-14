// Demand against capacity (spec 9.3 DEMAND): a bar that turns amber near capacity and red once over it.
import { CAPACITY_LABEL, NEAR_CAPACITY, capacityStatus, percent } from '../lib/format.ts';
import type { CapacityStatus } from '../lib/format.ts';
import { AlertIcon, CheckIcon } from './icons.tsx';

const tone: Record<CapacityStatus, { bar: string; chip: string; icon: string }> = {
  uncapped: { bar: 'bg-brand', chip: 'bg-brand-soft', icon: 'text-brand' },
  within: { bar: 'bg-fit-high', chip: 'bg-fit-high/10', icon: 'text-fit-high' },
  near: { bar: 'bg-fit-mid', chip: 'bg-fit-mid/15', icon: 'text-fit-mid' },
  over: { bar: 'bg-fit-low', chip: 'bg-fit-low/10', icon: 'text-fit-low' },
};

function CapacityChip({ status }: { status: CapacityStatus }) {
  const t = tone[status];
  const Icon = status === 'near' || status === 'over' ? AlertIcon : CheckIcon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t.chip}`}>
      <Icon className={`size-3.5 ${t.icon}`} />
      {CAPACITY_LABEL[status]}
    </span>
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

export function DemandGauge({ shortlisted, capacity }: { shortlisted: number; capacity: number | null }) {
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
      <p className="mt-2 text-xs text-muted">
        {capacity === null
          ? 'This module has no capacity limit.'
          : `${percent(shortlisted / capacity)} of capacity. Turns amber at ${percent(NEAR_CAPACITY)} and red above 100%.`}
      </p>
    </div>
  );
}
