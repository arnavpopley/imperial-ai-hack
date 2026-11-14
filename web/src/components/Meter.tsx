import { cx } from './cx.ts';

export type MeterTone = 'brand' | 'high' | 'mid' | 'low' | 'muted';

const fillClass: Record<MeterTone, string> = {
  brand: 'bg-brand',
  high: 'bg-fit-high',
  mid: 'bg-fit-mid',
  low: 'bg-fit-low',
  muted: 'bg-line-strong',
};

interface MeterProps {
  /** 0 to 1. */
  value: number;
  /** Accessible name, for example "Interest in fluid mechanics". */
  label: string;
  /** Spoken value, defaulting to a percentage. */
  valueText?: string;
  tone?: MeterTone;
  size?: 'sm' | 'md';
  className?: string;
}

/** A horizontal bar for a 0-1 quantity: interest strength, completeness, pathway progress. */
export function Meter({ value, label, valueText, tone = 'brand', size = 'sm', className }: MeterProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={valueText ?? `${pct}%`}
      className={cx('overflow-hidden rounded-full bg-surface-2', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out-soft', fillClass[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
