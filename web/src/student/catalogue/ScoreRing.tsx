// The fit ring with a fill that sweeps in on mount and glides when the score changes. Same bands and
// accessible name as the shared FitScore ring; reduced motion shows the final value at once.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { cx } from '../../components/cx.ts';
import { FIT_BAND_LABELS, fitBand } from '../../components/FitScore.tsx';

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const toneClass = { high: 'text-fit-high', mid: 'text-fit-mid', low: 'text-fit-low' } as const;

interface ScoreRingProps {
  value: number;
  size?: 'md' | 'lg';
  dimmed?: boolean;
  /** Seconds to wait before the first sweep, to stagger a list. */
  delay?: number;
  className?: string;
}

export function ScoreRing({ value, size = 'md', dimmed = false, delay = 0, className }: ScoreRingProps) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(reduce ? value : 0);
  const offset = useTransform(progress, (v) => CIRCUMFERENCE * (1 - v / 100));
  const shown = useTransform(progress, (v) => Math.round(v));
  /** The stagger delay applies to the first sweep only, so a re-rank glides at once. */
  const firstSweep = useRef(true);

  useEffect(() => {
    if (reduce) {
      progress.set(value);
      return;
    }
    const wait = firstSweep.current ? delay : 0;
    firstSweep.current = false;
    const controls = animate(progress, value, { duration: 0.9, delay: wait, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [value, reduce, progress, delay]);

  const band = fitBand(value);
  const tone = dimmed ? 'text-muted' : toneClass[band];
  const label = `Fit ${value} out of 100, ${FIT_BAND_LABELS[band].toLowerCase()}${dimmed ? ', shown greyed' : ''}`;
  const px = size === 'lg' ? 104 : 64;

  return (
    <div role="img" aria-label={label} className={cx('relative grid shrink-0 place-items-center', className)} style={{ width: px, height: px }}>
      <svg viewBox="0 0 48 48" width={px} height={px} className="-rotate-90" aria-hidden="true" focusable="false">
        <circle cx="24" cy="24" r={RADIUS} fill="none" className="stroke-surface-2" strokeWidth="4" />
        <motion.circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: offset }}
          className={cx('transition-colors duration-500', tone)}
        />
      </svg>
      <motion.span
        aria-hidden="true"
        className={cx(
          'absolute font-semibold tracking-tight tabular-nums',
          size === 'lg' ? 'text-3xl' : 'text-lg',
          dimmed ? 'text-muted' : 'text-ink',
        )}
      >
        {shown}
      </motion.span>
    </div>
  );
}
