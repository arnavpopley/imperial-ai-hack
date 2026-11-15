// Building blocks shared by every staff screen: panels, buttons and the loading, empty and error states.
import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { focusRing } from '../lib/format.ts';
import { AlertIcon } from './icons.tsx';

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg ${className}`}
    >
      {(title || actions) && (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-surface hover:bg-brand/90 disabled:bg-brand/40',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas disabled:text-muted',
  ghost: 'text-muted hover:bg-canvas hover:text-ink disabled:text-muted/60',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${focusRing} ${className}`}
      {...props}
    />
  );
}

export function LoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-16 animate-pulse rounded-card bg-line/60" />
      ))}
    </div>
  );
}

export function ErrorState({ title, error, onRetry }: { title: string; error: Error; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-card border border-fit-low/30 bg-fit-low/5 p-4"
    >
      <AlertIcon className="mt-0.5 size-5 text-fit-low" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 break-words text-sm text-muted">{error.message}</p>
      </div>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  image,
  children,
}: {
  icon?: ReactNode;
  title: string;
  /** Optional illustrative photo from /images, shown above the title. */
  image?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-strong px-6 py-12 text-center">
      {image && (
        <img src={image} alt="" className="mb-2 aspect-[16/9] w-full max-w-sm rounded-2xl object-cover shadow-soft" />
      )}
      {icon && !image && <span className="text-muted">{icon}</span>}
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'bg-brand-soft text-brand',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** A small icon in a tinted square beside the label. */
  icon?: ReactNode;
  /** Tailwind classes for the icon square. */
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line">
      {icon && (
        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
        {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
      </div>
    </div>
  );
}

/** Radio group styled as a segmented control; arrow keys move between options natively. */
export function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink has-checked:border-brand has-checked:bg-brand-soft has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
            {o.count !== undefined && <span className="ml-1 tabular-nums text-muted">{o.count}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
