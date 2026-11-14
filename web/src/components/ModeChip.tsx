import { MODE_LABELS, type Mode } from '@modulematch/shared';
import { cx } from './cx.ts';

const modeClass: Record<Mode, string> = {
  ONBOARD: 'bg-mode-onboard/10 text-mode-onboard ring-mode-onboard/25',
  INTERVIEW: 'bg-mode-interview/10 text-mode-interview ring-mode-interview/25',
  RECOMMEND: 'bg-mode-recommend/10 text-mode-recommend ring-mode-recommend/25',
  EXPLAIN: 'bg-mode-explain/10 text-mode-explain ring-mode-explain/25',
  PLAN: 'bg-mode-plan/10 text-mode-plan ring-mode-plan/25',
  ESCALATED: 'bg-mode-escalated/10 text-mode-escalated ring-mode-escalated/25',
};

const dotClass: Record<Mode, string> = {
  ONBOARD: 'bg-mode-onboard',
  INTERVIEW: 'bg-mode-interview',
  RECOMMEND: 'bg-mode-recommend',
  EXPLAIN: 'bg-mode-explain',
  PLAN: 'bg-mode-plan',
  ESCALATED: 'bg-mode-escalated',
};

/** Modes where an agent is actively working with the student get a pulsing dot. */
const LIVE_MODES: ReadonlySet<Mode> = new Set(['INTERVIEW', 'EXPLAIN', 'ESCALATED']);

/** The Supervisor's current mode (spec 12), always visible on student screens. One variant per mode. */
export function ModeChip({ variant, className }: { variant: Mode; className?: string }) {
  return (
    <p
      aria-live="polite"
      className={cx(
        'inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        modeClass[variant],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-2 rounded-full', dotClass[variant], LIVE_MODES.has(variant) && 'animate-pulse-dot')}
      />
      <span className="sr-only">Mode: </span>
      {MODE_LABELS[variant]}
    </p>
  );
}
