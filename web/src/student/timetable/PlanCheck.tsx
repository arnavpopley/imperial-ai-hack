// Issue 143: clashes, kept-free time and the programme rules as one card of rows with meters. Red is kept for a
// real break; an unfinished shortlist is progress. The rule messages sit behind one disclosure.
import type { TimetableView } from '@modulematch/shared';
import { Link } from 'react-router';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { Meter, type MeterTone } from '../../components/Meter.tsx';
import { DAY_LABELS, keepFreeLabel, TERM_LABELS } from '../labels.ts';
import { paths } from '../routes.ts';
import { planChecks, ruleDetails, type CheckState } from './planCheck.ts';

const STATE: Record<CheckState, { icon: IconName; tone: string; meter: MeterTone; word: string }> = {
  met: { icon: 'check', tone: 'bg-fit-high text-on-brand', meter: 'high', word: 'met' },
  todo: { icon: 'clock', tone: 'bg-surface-2 text-muted ring-1 ring-line-strong ring-inset', meter: 'brand', word: 'to do' },
  issue: { icon: 'ban', tone: 'bg-fit-low text-on-brand', meter: 'low', word: 'needs attention' },
  note: { icon: 'info', tone: 'bg-fit-mid/15 text-fit-mid', meter: 'mid', word: 'note' },
};

export function PlanCheck({ view, titleFor }: { view: TimetableView; titleFor: (id: string) => string }) {
  const rows = planChecks(view);
  const met = rows.filter((r) => r.state === 'met').length;
  const details = ruleDetails(view);
  return (
    <section aria-labelledby="plan-check-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="plan-check-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="shield" size={15} className="text-brand" />
          Plan check
        </h2>
        <span className="text-[12px] text-muted tabular-nums">
          {met} of {rows.length} met
        </span>
      </div>
      <ul className="grid gap-3">
        {rows.map((row) => {
          const state = STATE[row.state];
          return (
            <li key={row.id} data-check={row.id} data-state={row.state} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5">
              <span className={cx('grid size-6 place-items-center rounded-full', state.tone)} aria-hidden="true">
                <Icon name={row.id === 'keep-free' && row.state === 'note' ? 'moon' : state.icon} size={12} />
              </span>
              <div className="min-w-0">
                <p className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium">
                    {row.label}
                    <span className="sr-only">, {state.word}</span>
                  </span>
                  <span className={cx('shrink-0 tabular-nums', row.state === 'issue' ? 'font-semibold text-fit-low' : 'text-muted')}>
                    {row.value}
                  </span>
                </p>
                {row.progress !== undefined && (
                  <Meter
                    value={row.progress}
                    label={row.label}
                    valueText={row.value}
                    tone={row.state === 'todo' ? 'brand' : state.meter}
                    className="mt-1.5"
                  />
                )}
                {row.id === 'i-explore' && row.state === 'todo' && (
                  <Link to={paths.catalogue} className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand underline-offset-2 hover:underline">
                    Find one
                    <Icon name="arrow-right" size={12} />
                  </Link>
                )}
                {row.id === 'keep-free' && view.keepFreeConflicts.length > 0 && (
                  <ul className="mt-1 grid gap-0.5 text-[12px] text-muted">
                    {view.keepFreeConflicts.slice(0, 3).map(({ slot, window }) => (
                      <li key={`${slot.moduleId}|${slot.sessionKey}|${slot.day}|${slot.start}`} className="truncate">
                        <span className="font-medium text-ink tabular-nums">
                          {DAY_LABELS[slot.day]} {slot.start}
                        </span>{' '}
                        {TERM_LABELS[slot.term]} · {titleFor(slot.moduleId)} · {keepFreeLabel(window)}
                      </li>
                    ))}
                    {view.keepFreeConflicts.length > 3 && <li>and {view.keepFreeConflicts.length - 3} more</li>}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <details className="group mt-3 border-t border-line pt-2.5 text-[12px] text-muted">
        <summary className="cursor-pointer font-medium marker:text-muted hover:text-ink">Rule details</summary>
        <ul className="mt-1.5 grid gap-1">
          {details.map((message) => (
            <li key={message}>{message}</li>
          ))}
          <li>No agent can override a rule. Exceptions go to the Senior Tutor.</li>
        </ul>
      </details>
    </section>
  );
}
