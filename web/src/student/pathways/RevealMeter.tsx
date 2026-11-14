// A 0-1 progress bar that fills from empty the first time it scrolls into view. Same semantics as the
// shared Meter (role="meter"); reduced motion shows the value at once.
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../../components/cx.ts';
import type { MeterTone } from '../../components/Meter.tsx';

const fillClass: Record<MeterTone, string> = {
  brand: 'bg-brand',
  high: 'bg-fit-high',
  mid: 'bg-fit-mid',
  low: 'bg-fit-low',
  muted: 'bg-line-strong',
};

interface RevealMeterProps {
  value: number;
  label: string;
  tone?: MeterTone;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
  className?: string;
}

export function RevealMeter({ value, label, tone = 'brand', size = 'sm', delay = 0, className }: RevealMeterProps) {
  const reduce = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className={cx(
        'overflow-hidden rounded-full bg-surface-2',
        size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2.5' : 'h-3.5',
        className,
      )}
    >
      {reduce ? (
        <div className={cx('h-full rounded-full', fillClass[tone])} style={{ width: `${pct}%` }} />
      ) : (
        <motion.div
          className={cx('h-full rounded-full', fillClass[tone])}
          initial={{ width: '0%' }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, delay, ease: [0.2, 0.8, 0.2, 1] }}
        />
      )}
    </div>
  );
}
