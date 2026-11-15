// One page header for every student and staff screen (issue 136): a title, a one-line subtitle and, on the right,
// the sample-data label above an at-a-glance slot of real data and any actions. It sits on the canvas wash with no
// photo, about 96px tall at 1440, so each screen's first content starts above the fold.
//
//   [eyebrow]                                                     [label]
//   Title                                            [glance] [actions]
//   One-line subtitle
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

interface PageHeaderProps {
  title: ReactNode;
  /** One short line; keep it to one line at 1440. */
  subtitle?: ReactNode;
  /** A small line above the title, such as a privacy note or a back link. */
  eyebrow?: ReactNode;
  /** The sample or synthetic data label, top right. */
  label?: ReactNode;
  /** Real data at a glance, such as GlanceStats, a meter or a mini chart. */
  glance?: ReactNode;
  /** Buttons or links for the page as a whole. */
  actions?: ReactNode;
  /** Id for the h1, when something else points at the title. */
  titleId?: string;
  className?: string;
}

export function PageHeader({ title, subtitle, eyebrow, label, glance, actions, titleId, className }: PageHeaderProps) {
  const side = glance || actions;
  return (
    <header className={cx('flex flex-wrap items-end justify-between gap-x-8 gap-y-3', className)}>
      <div className="grid min-w-0 flex-[1_1_22rem] gap-1">
        {eyebrow && <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{eyebrow}</div>}
        <h1 id={titleId} className="text-title text-balance">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted text-pretty">{subtitle}</p>}
      </div>
      {(label || side) && (
        <div className="grid min-w-0 justify-items-start gap-2 sm:justify-items-end">
          {label}
          {side && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
              {glance}
              {actions}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export interface GlanceItem {
  label: string;
  value: ReactNode;
  /** Spoken in place of the value, when the value is a picture. */
  valueText?: string;
}

/** A row of small figures for the glance slot: "46 modules · 33 open · best fit 63". */
export function GlanceStats({ items, label, children, className }: { items: readonly GlanceItem[]; label: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 items-stretch rounded-2xl bg-surface/80 shadow-soft ring-1 ring-line', className)}>
      <dl aria-label={label} className="flex min-w-0 items-stretch divide-x divide-line">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col-reverse justify-center px-3.5 py-1.5">
            <dt className="truncate text-2xs leading-tight text-muted">{item.label}</dt>
            <dd className="text-lg leading-tight font-semibold tabular-nums">
              {item.valueText ? (
                <>
                  <span aria-hidden="true">{item.value}</span>
                  <span className="sr-only">{item.valueText}</span>
                </>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {children && <div className="flex items-center border-l border-line px-3.5 py-1.5">{children}</div>}
    </div>
  );
}
