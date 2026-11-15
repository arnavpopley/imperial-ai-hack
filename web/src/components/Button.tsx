import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx.ts';
import { Icon, type IconName } from './Icon.tsx';
import { Spinner } from './Spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand shadow-soft hover:brightness-110 active:brightness-95',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-fit-low text-on-brand hover:brightness-110',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
};

/** Shared button styling for links and other elements that look like buttons. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition duration-150 select-none disabled:pointer-events-none disabled:opacity-50',
    variantClass[variant],
    sizeClass[size],
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Shows a spinner in place of the icon and disables the button. */
  busy?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  busy = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass(variant, size), className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner size={size === 'sm' ? 12 : 14} /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}
