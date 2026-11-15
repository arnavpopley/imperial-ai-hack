import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon, type IconName } from './Icon.tsx';

export type GuardrailVariant = 'redacted' | 'blocked' | 'out-of-scope' | 'wellbeing';

const meta: Record<GuardrailVariant, { title: string; icon: IconName; className: string; iconClass: string }> = {
  redacted: {
    title: 'Not stored',
    icon: 'eye-off',
    className: 'border-brand/25 bg-brand-soft/60',
    iconClass: 'bg-brand/12 text-brand',
  },
  blocked: {
    title: 'Held back',
    icon: 'ban',
    className: 'border-fit-low/30 bg-fit-low/6',
    iconClass: 'bg-fit-low/12 text-fit-low',
  },
  'out-of-scope': {
    title: 'Outside what I can help with',
    icon: 'compass',
    className: 'border-line-strong bg-surface-2',
    iconClass: 'bg-ink/8 text-muted',
  },
  wellbeing: {
    title: 'You do not have to handle this alone',
    icon: 'heart',
    className: 'border-mode-explain/30 bg-mode-explain/6',
    iconClass: 'bg-mode-explain/12 text-mode-explain',
  },
};

interface GuardrailNoticeProps {
  /** redacted (G2), blocked (G3, G6 to G8), out-of-scope (G1) or wellbeing (G4), per spec 11. */
  variant: GuardrailVariant;
  /** The notice text the guardrail stage sent. */
  message: string;
  /** Stage name, for example "G2 redaction", shown so the student can see which check acted. */
  stage?: string;
  children?: ReactNode;
  className?: string;
}

export function GuardrailNotice({ variant, message, stage, children, className }: GuardrailNoticeProps) {
  const m = meta[variant];
  return (
    <aside
      role={variant === 'wellbeing' ? 'alert' : 'note'}
      aria-label={m.title}
      className={cx('animate-rise flex gap-3 rounded-xl border px-3.5 py-3 text-[13px]', m.className, className)}
    >
      <span className={cx('grid size-7 shrink-0 place-items-center rounded-full', m.iconClass)}>
        <Icon name={m.icon} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 font-semibold">
          {m.title}
          {stage && (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-muted">
              <Icon name="shield" size={11} />
              {stage}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-muted">{message}</p>
        {variant === 'wellbeing' && (
          <ul className="mt-2 grid gap-1 text-ink">
            <li>
              <span className="font-medium">Imperial Student Counselling and Mental Health Advice Service</span>
            </li>
            <li>
              <span className="font-medium">Samaritans</span>: call 116 123, free, any time
            </li>
            <li>
              <span className="font-medium">In an emergency</span>: call 999
            </li>
          </ul>
        )}
        {children}
      </div>
    </aside>
  );
}
