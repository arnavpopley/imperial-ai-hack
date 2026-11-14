import type { Confidence } from '@modulematch/shared';
import { cx } from './cx.ts';

const meta: Record<Confidence, { label: string; bars: number; className: string; detail: string }> = {
  high: {
    label: 'High confidence',
    bars: 3,
    className: 'text-fit-high bg-fit-high/10',
    detail: 'Your profile is complete enough for these scores to be reliable.',
  },
  medium: {
    label: 'Medium confidence',
    bars: 2,
    className: 'text-fit-mid bg-fit-mid/12',
    detail: 'A couple more answers would sharpen these scores.',
  },
  low: {
    label: 'Low confidence',
    bars: 1,
    className: 'text-fit-low bg-fit-low/10',
    detail: 'We know too little about you yet. Treat these scores as rough.',
  },
};

/** How sure the scores are, from profile completeness (spec 8.6). */
export function ConfidenceBadge({ variant, className }: { variant: Confidence; className?: string }) {
  const m = meta[variant];
  return (
    <span
      title={m.detail}
      className={cx('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', m.className, className)}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={1 + i * 4}
            y={8 - i * 3}
            width="2.5"
            height={3 + i * 3}
            rx="0.8"
            fill="currentColor"
            opacity={i < m.bars ? 1 : 0.25}
          />
        ))}
      </svg>
      {m.label}
      <span className="sr-only">. {m.detail}</span>
    </span>
  );
}
