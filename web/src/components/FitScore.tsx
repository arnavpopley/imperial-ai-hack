import { FIT_BAND_LABELS, fitBand, type FitBand } from '@modulematch/shared';
import type { BadgeTone } from './Badge.tsx';
import { cx } from './cx.ts';
import type { MeterTone } from './Meter.tsx';

// The bands and labels are shared with the server's explanations and the staff console (issue #105).
export { FIT_BAND_LABELS, fitBand, type FitBand };

/** Text colour per band. Strong and good are both greens, so a good match never reads as a warning. */
export const FIT_BAND_TEXT: Record<FitBand, string> = {
  strong: 'text-fit-high',
  good: 'text-mode-recommend',
  partial: 'text-fit-mid',
  weak: 'text-fit-low',
};

/** Badge tone per band, for a fit band chip. */
export const FIT_BAND_TONE: Record<FitBand, BadgeTone> = { strong: 'success', good: 'success', partial: 'warning', weak: 'danger' };

/** Meter tone per band, for bars beside a fit. */
export const FIT_BAND_METER: Record<FitBand, MeterTone> = { strong: 'high', good: 'high', partial: 'mid', weak: 'low' };

const strokeClass = FIT_BAND_TEXT;

interface FitScoreProps {
  value: number;
  /** ring: a coloured ring around the number. compact: a number with a band dot, for dense rows. */
  variant?: 'ring' | 'compact';
  size?: 'md' | 'lg';
  /** Grey the score out, for low-confidence profiles (spec 8.6) and ineligible modules. */
  dimmed?: boolean;
  className?: string;
}

export function FitScore({ value, variant = 'ring', size = 'md', dimmed = false, className }: FitScoreProps) {
  const band = fitBand(value);
  const tone = dimmed ? 'text-muted' : strokeClass[band];
  const label = `Fit ${value} out of 100, ${FIT_BAND_LABELS[band].toLowerCase()}${dimmed ? ', shown greyed' : ''}`;

  if (variant === 'compact') {
    return (
      <span role="img" aria-label={label} className={cx('inline-flex items-center gap-1.5 font-semibold tabular-nums', className)}>
        <span className={cx('size-2 rounded-full bg-current', tone)} aria-hidden="true" />
        {value}
      </span>
    );
  }

  const px = size === 'lg' ? 96 : 60;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="img"
      aria-label={label}
      className={cx('relative grid shrink-0 place-items-center', className)}
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 0 48 48" width={px} height={px} className="-rotate-90" aria-hidden="true" focusable="false">
        <circle cx="24" cy="24" r={radius} fill="none" className="stroke-surface-2" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className={cx('transition-[stroke-dashoffset,color] duration-500 ease-out-soft', tone)}
        />
      </svg>
      <span
        aria-hidden="true"
        className={cx(
          'absolute font-semibold tracking-tight tabular-nums',
          size === 'lg' ? 'text-3xl' : 'text-lg',
          dimmed ? 'text-muted' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}
