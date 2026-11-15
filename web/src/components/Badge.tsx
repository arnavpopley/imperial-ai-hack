// One badge for every chip in the app (issue #141): a small set of tones and two variants, one radius
// (rounded-full) and sentence case throughout. Uppercase is kept for section eyebrows, never for badges.
import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon, type IconName } from './Icon.tsx';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'ai';
export type BadgeVariant = 'soft' | 'outline';
export type BadgeSize = 'sm' | 'md';

interface ToneSpec {
  soft: string;
  outline: string;
  /** The colour tokens behind the classes, so a test can check 4.5:1 or better in light and dark. */
  colours: { text: string; tint: string; alpha: number };
  /** The dot's fill. */
  dot: string;
}

/**
 * Tones map to the shared colour tokens: violet (`mode-explain`) means AI and is used for nothing else, and the fit
 * colours carry success, warning and danger, as they do on the scores.
 */
export const BADGE_TONES: Record<BadgeTone, ToneSpec> = {
  neutral: {
    soft: 'bg-surface-2 text-ink ring-1 ring-line ring-inset',
    outline: 'text-ink ring-1 ring-line-strong ring-inset',
    colours: { text: 'ink', tint: 'surface-2', alpha: 1 },
    dot: 'bg-muted',
  },
  brand: {
    soft: 'bg-brand-soft text-brand',
    outline: 'text-brand ring-1 ring-brand/50 ring-inset',
    colours: { text: 'brand', tint: 'brand-soft', alpha: 1 },
    dot: 'bg-brand',
  },
  success: {
    soft: 'bg-fit-high/10 text-fit-high',
    outline: 'text-fit-high ring-1 ring-fit-high/50 ring-inset',
    colours: { text: 'fit-high', tint: 'fit-high', alpha: 0.1 },
    dot: 'bg-fit-high',
  },
  warning: {
    soft: 'bg-fit-mid/10 text-fit-mid',
    outline: 'text-fit-mid ring-1 ring-fit-mid/50 ring-inset',
    colours: { text: 'fit-mid', tint: 'fit-mid', alpha: 0.1 },
    dot: 'bg-fit-mid',
  },
  danger: {
    soft: 'bg-fit-low/10 text-fit-low',
    outline: 'text-fit-low ring-1 ring-fit-low/50 ring-inset',
    colours: { text: 'fit-low', tint: 'fit-low', alpha: 0.1 },
    dot: 'bg-fit-low',
  },
  info: {
    soft: 'bg-mode-plan/6 text-mode-plan ring-1 ring-mode-plan/30 ring-inset',
    outline: 'text-mode-plan ring-1 ring-mode-plan/50 ring-inset',
    colours: { text: 'mode-plan', tint: 'mode-plan', alpha: 0.06 },
    dot: 'bg-mode-plan',
  },
  ai: {
    soft: 'bg-mode-explain/6 text-mode-explain ring-1 ring-mode-explain/30 ring-inset',
    outline: 'text-mode-explain ring-1 ring-mode-explain/50 ring-inset',
    colours: { text: 'mode-explain', tint: 'mode-explain', alpha: 0.06 },
    dot: 'bg-mode-explain',
  },
};

const SIZES: Record<BadgeSize, { box: string; height: string; minHeight: string; icon: number }> = {
  sm: { box: 'gap-1 px-2 text-2xs', height: 'h-5', minHeight: 'min-h-5', icon: 11 },
  md: { box: 'gap-1.5 px-2.5 text-xs', height: 'h-6', minHeight: 'min-h-6', icon: 13 },
};

/** The badge's classes, for controls that must look like a badge (for example a popover trigger). */
export function badgeClass({
  tone = 'neutral',
  variant = 'soft',
  size = 'sm',
  wrap = false,
}: { tone?: BadgeTone; variant?: BadgeVariant; size?: BadgeSize; wrap?: boolean } = {}) {
  return cx(
    'inline-flex items-center rounded-full font-semibold',
    // A wrapping badge keeps its height on one line and grows only when its column is too narrow for the label.
    wrap ? cx('max-w-full py-0.5', SIZES[size].minHeight) : cx('shrink-0 whitespace-nowrap', SIZES[size].height),
    SIZES[size].box,
    BADGE_TONES[tone][variant],
  );
}

interface BadgeProps {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** An icon name, or a small custom glyph such as the confidence bars. */
  icon?: IconName | ReactNode;
  /** A leading status dot, for states such as "Open". */
  dot?: boolean;
  /** Let a long, data-driven label wrap on a narrow screen instead of widening its container. */
  wrap?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', variant = 'soft', size = 'sm', icon, dot = false, wrap = false, title, className, children }: BadgeProps) {
  return (
    <span title={title} className={cx(badgeClass({ tone, variant, size, wrap }), className)}>
      {dot && <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', BADGE_TONES[tone].dot)} />}
      {typeof icon === 'string' ? <Icon name={icon as IconName} size={SIZES[size].icon} className="shrink-0" /> : icon}
      {children}
    </span>
  );
}
