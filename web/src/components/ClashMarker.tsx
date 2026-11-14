import type { ClashLabel } from '@modulematch/shared';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

export const CLASH_LABELS: Record<ClashLabel, string> = {
  certain: 'Certain clash',
  likely: 'Likely clash',
  possible: 'Possible clash',
};

// Likely and possible keep ink text for contrast; the clash colour carries the fill, outline and icon.
const variantClass: Record<ClashLabel, string> = {
  certain: 'bg-clash-certain text-on-brand',
  likely: 'bg-clash-likely/15 text-ink ring-1 ring-clash-likely ring-inset',
  possible: 'bg-clash-possible/15 text-ink border border-dashed border-clash-possible',
};

const iconClass: Record<ClashLabel, string | undefined> = {
  certain: undefined,
  likely: 'text-clash-likely',
  possible: 'text-clash-possible',
};

/** Text colour per label, for clash overlap bands and outlines that sit next to a marker. */
export const CLASH_TEXT_CLASS: Record<ClashLabel, string> = {
  certain: 'text-clash-certain',
  likely: 'text-clash-likely',
  possible: 'text-clash-possible',
};

interface ClashMarkerProps {
  /** certain: P = 1. likely: 0.3 to 1. possible: under 0.3 (spec 9.2). */
  variant: ClashLabel;
  probability?: number;
  /** Icon-only pin for inside the timetable grid. The label stays available to screen readers. */
  compact?: boolean;
  className?: string;
}

export function ClashMarker({ variant, probability, compact = false, className }: ClashMarkerProps) {
  const pct = probability === undefined ? null : Math.round(probability * 100);
  const text = pct === null || variant === 'certain' ? CLASH_LABELS[variant] : `${CLASH_LABELS[variant]}, ${pct}%`;
  return (
    <span
      title={compact ? text : undefined}
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        compact ? 'size-5 justify-center' : 'h-6 px-2 text-[11px]',
        variantClass[variant],
        className,
      )}
    >
      <Icon name={variant === 'possible' ? 'clock' : 'swap'} size={compact ? 11 : 12} className={iconClass[variant]} />
      <span className={compact ? 'sr-only' : undefined}>{text}</span>
    </span>
  );
}
