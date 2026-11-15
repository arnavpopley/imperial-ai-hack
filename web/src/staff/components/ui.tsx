// Layout blocks for the staff screens: panels, stat tiles and the segmented filter. Buttons, icons and the loading,
// empty and error states come from the shared components in web/src/components (issue #142).
import { useId } from 'react';
import { InfoTip } from '../../components/InfoTip.tsx';
import type { ReactNode } from 'react';

export function Panel({
  title,
  description,
  info,
  actions,
  children,
  className = '',
}: {
  title?: string;
  /** Always visible under the title: keep it for things a reader must not miss. */
  description?: ReactNode;
  /** Background detail, tucked behind an "i" button beside the title. */
  info?: ReactNode;
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
              <h2 id={headingId} className="flex items-center gap-1.5 text-heading">
                {title}
                {info && <InfoTip label={`About ${title.toLowerCase()}`}>{info}</InfoTip>}
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
  // Valid list markup: each tile is the dl's `div`, holding only its dt and dd. The icon sits inside the dt,
  // positioned in the tile's left gutter, so no extra wrapper comes between the div and its dt and dd.
  return (
    <div className={`relative min-w-0 rounded-panel bg-surface px-card py-5 shadow-soft ring-1 ring-line ${icon ? 'pl-[5.25rem]' : ''}`}>
      <dt className="text-sm font-medium text-muted">
        {icon && (
          <span aria-hidden="true" className={`absolute top-5 left-card grid size-11 place-items-center rounded-2xl ${tone}`}>
            {icon}
          </span>
        )}
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
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
