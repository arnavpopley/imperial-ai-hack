// The fit ring with a fill that sweeps in on mount and glides when the score changes. Same bands and
// accessible name as the shared FitScore ring; reduced motion shows the final value at once.
//
// Motion follows the education skill's tokens: the first sweep is a content reveal (lessonTransition,
// 350ms ease-in-out), and a re-score is a progress update (300ms ease-out) whose number then settles
// with a small follow-through nudge in the direction it moved.
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { cx } from '../../components/cx.ts';
import { FIT_BAND_LABELS, FIT_BAND_TEXT, fitBand } from '../../components/FitScore.tsx';
import { MOTION, useMotionTokens } from '../../motion/tokens.ts';

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** How far, in pixels, the number lifts or dips before it settles. */
const SETTLE_NUDGE = 3;


interface ScoreRingProps {
  value: number;
  size?: 'md' | 'lg';
  dimmed?: boolean;
  /** Seconds to wait before the first sweep, to stagger a list. */
  delay?: number;
  className?: string;
}

export function ScoreRing({ value, size = 'md', dimmed = false, delay = 0, className }: ScoreRingProps) {
  const { reduce } = useMotionTokens();
  const progress = useMotionValue(reduce ? value : 0);
  const numberY = useMotionValue(0);
  const offset = useTransform(progress, (v) => CIRCUMFERENCE * (1 - v / 100));
  const shown = useTransform(progress, (v) => Math.round(v));
  /** The stagger delay applies to the first sweep only, so a re-rank glides at once. */
  const firstSweep = useRef(true);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (reduce) {
      progress.set(value);
      numberY.set(0);
      firstSweep.current = false;
      return;
    }
    if (firstSweep.current) {
      firstSweep.current = false;
      const controls = animate(progress, value, { ...MOTION.lessonTransition, delay });
      return () => controls.stop();
    }
    const ring = animate(progress, value, MOTION.progressUpdate);
    // Follow-through: the number rides up (or down) with the change, then springs back into place.
    numberY.set(value > from ? -SETTLE_NUDGE : value < from ? SETTLE_NUDGE : 0);
    const settle = animate(numberY, 0, MOTION.settle);
    return () => {
      ring.stop();
      settle.stop();
    };
  }, [value, reduce, progress, numberY, delay]);

  const band = fitBand(value);
  const tone = dimmed ? 'text-muted' : FIT_BAND_TEXT[band];
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
          className={cx('transition-colors duration-300 ease-out', tone)}
        />
      </svg>
      <motion.span
        aria-hidden="true"
        style={{ y: numberY }}
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

/** In place of the ring when there is nothing to score yet (no interests or pathway, spec 8.6). */
export function NoScoreRing({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  const px = size === 'lg' ? 104 : 64;
  return (
    <div
      role="img"
      aria-label="No fit score yet"
      className={cx('grid shrink-0 place-items-center rounded-full border-4 border-dashed border-surface-2 text-muted', className)}
      style={{ width: px, height: px }}
    >
      <span aria-hidden="true" className={cx('font-semibold', size === 'lg' ? 'text-3xl' : 'text-lg')}>
        –
      </span>
    </div>
  );
}
