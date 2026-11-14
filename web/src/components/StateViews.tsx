// Loading, empty and error states shared by every screen.
import type { ReactNode } from 'react';
import { Button } from './Button.tsx';
import { cx } from './cx.ts';
import { Icon, type IconName } from './Icon.tsx';
import { Spinner } from './Spinner.tsx';

/** A shimmering placeholder block. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-lg bg-surface-2', className)} />;
}

export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cx('flex items-center justify-center gap-2 py-16 text-sm text-muted', className)}>
      <Spinner />
      {label}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, children, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx('flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center', className)}
    >
      <span className="grid size-10 place-items-center rounded-full bg-fit-low/10 text-fit-low">
        <Icon name="info" size={20} />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-md text-sm break-words text-muted">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button size="sm" icon="reset" onClick={onRetry}>
            Try again
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-6 py-12 text-center',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Turns an unknown thrown value into a message fit to show a student. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The request failed. Check your connection and try again.';
}
