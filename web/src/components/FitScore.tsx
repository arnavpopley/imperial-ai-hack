import { cx } from './cx.ts';

export type FitBand = 'high' | 'mid' | 'low';

/** Fit bands. 75 matches the "convinced" line the insights engine uses (spec 9.3). */
export function fitBand(fit: number): FitBand {
  if (fit >= 75) return 'high';
  if (fit >= 50) return 'mid';
  return 'low';
}

export const FIT_BAND_LABELS: Record<FitBand, string> = { high: 'Strong fit', mid: 'Partial fit', low: 'Weak fit' };

const strokeClass: Record<FitBand, string> = { high: 'text-fit-high', mid: 'text-fit-mid', low: 'text-fit-low' };

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
