import type { Confidence } from '@modulematch/shared';
import { Badge, type BadgeTone } from './Badge.tsx';

const meta: Record<Confidence, { label: string; bars: number; tone: BadgeTone; detail: string }> = {
  high: {
    label: 'High confidence',
    bars: 3,
    tone: 'success',
    detail: 'Your profile is complete enough for these scores to be reliable.',
  },
  medium: {
    label: 'Medium confidence',
    bars: 2,
    tone: 'warning',
    detail: 'A couple more answers would sharpen these scores.',
  },
  low: {
    label: 'Low confidence',
    bars: 1,
    tone: 'danger',
    detail: 'We know too little about you yet. Treat these scores as rough.',
  },
};

/** How sure the scores are, from profile completeness (spec 8.6). */
export function ConfidenceBadge({ variant, className }: { variant: Confidence; className?: string }) {
  const m = meta[variant];
  return (
    <Badge tone={m.tone} title={m.detail} className={className} icon={<Bars filled={m.bars} />}>
      {m.label}
      <span className="sr-only">. {m.detail}</span>
    </Badge>
  );
}

/** Three signal bars, `filled` of them solid. */
function Bars({ filled }: { filled: number }) {
  return (
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
          opacity={i < filled ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}
