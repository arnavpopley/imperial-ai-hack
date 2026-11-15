// A Monday to Friday, 09:00 to 18:00 grid for one term. Provisional slots are dashed with their
// probability; overlaps between clashing slots are hatched and pinned with a clash marker. Core modules are
// grey and locked, kept-free time is shaded violet, and a shortlisted session inside it gets a dashed outline.
import type { Clash, ClashLabel, KeepFreeConflict, KeepFreeWindow, Slot, Term, Weekday } from '@modulematch/shared';
import { useState } from 'react';
import { ClashMarker, CLASH_LABELS, CLASH_TEXT_CLASS } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { DAY_LABELS, DAY_NAMES, keepFreeLabel, TERM_LABELS, WEEKDAYS } from '../labels.ts';
import {
  dayOffset,
  DAY_END,
  DAY_START,
  formatRange,
  HOURS,
  layoutDay,
  overlapBands,
  slotKey,
  toMinutes,
} from './layout.ts';
import { useMediaQuery } from '../hooks/useMediaQuery.ts';
import type { ModuleColour } from './moduleColours.ts';

const RING_CLASS: Record<ClashLabel, string> = {
  certain: 'ring-2 ring-clash-certain',
  likely: 'ring-2 ring-clash-likely',
  possible: 'ring-2 ring-clash-possible ring-offset-1 ring-offset-surface',
};

const SEVERITY: Record<ClashLabel, number> = { certain: 3, likely: 2, possible: 1 };

interface WeekGridProps {
  term: Term;
  slots: readonly Slot[];
  clashes: readonly Clash[];
  colourFor: (moduleId: string) => ModuleColour;
  codeFor: (moduleId: string) => string;
  titleFor: (moduleId: string) => string;
  /** Compulsory core modules: drawn locked and grey rather than in a module colour. */
  coreIds?: ReadonlySet<string>;
  keepFree?: readonly KeepFreeWindow[];
  keepFreeConflicts?: readonly KeepFreeConflict[];
}

const CORE_BLOCK = 'bg-ink/[0.07] border-ink/45';

export function WeekGrid({
  term,
  slots,
  clashes,
  colourFor,
  codeFor,
  titleFor,
  coreIds = new Set<string>(),
  keepFree = [],
  keepFreeConflicts = [],
}: WeekGridProps) {
  const bands = overlapBands(clashes, term);
  const keptFree = new Set(keepFreeConflicts.filter((c) => c.slot.term === term).map((c) => slotKey(c.slot)));
  const firstEarlyDay = keepFree.find((w) => w.reason === 'early')?.day;
  // The worst clash each slot is part of, for its outline.
  const clashOf = new Map<string, ClashLabel>();
  for (const clash of clashes) {
    if (clash.term !== term) continue;
    for (const { a, b } of clash.overlaps) {
      for (const s of [a, b]) {
        const current = clashOf.get(slotKey(s));
        if (!current || SEVERITY[clash.label] > SEVERITY[current]) clashOf.set(slotKey(s), clash.label);
      }
    }
  }
  const hourCount = (DAY_END - DAY_START) / 60;
  // Issue 64: a phone shows one day at a time with a day switcher, instead of a five-column grid clipped at Wednesday.
  const narrow = useMediaQuery('(max-width: 639px)');
  // Open on the first day with a clash, else the first day with teaching.
  const firstDay =
    WEEKDAYS.find((d) => slots.some((s) => s.day === d && clashOf.has(slotKey(s)))) ??
    WEEKDAYS.find((d) => slots.some((s) => s.day === d)) ??
    'mon';
  const [picked, setPicked] = useState<Weekday | null>(null);
  const shownDay = picked ?? firstDay;
  const days = narrow ? [shownDay] : WEEKDAYS;
  const columns = narrow ? 'grid-cols-[3rem_minmax(0,1fr)]' : 'grid-cols-[3rem_repeat(5,minmax(0,1fr))]';

  return (
    // A phone shows one day, so nothing scrolls. Wider screens keep the whole week; if it is wider than the screen
    // it scrolls sideways, and the scroller takes focus so arrow keys can scroll it too.
    <div
      {...(narrow
        ? {}
        : {
            tabIndex: 0,
            role: 'region',
            'aria-label': `${TERM_LABELS[term]} term week, scrolls sideways`,
            className: '-mx-4 overflow-x-auto px-4 outline-none focus-visible:ring-2 focus-visible:ring-brand sm:mx-0 sm:px-0',
          })}
    >
      {narrow && (
        <div role="group" aria-label="Day" className="mb-3 grid grid-cols-5 gap-1 rounded-xl bg-surface-2 p-1">
          {WEEKDAYS.map((d) => {
            const count = slots.filter((s) => s.day === d).length;
            const clashing = slots.some((s) => s.day === d && clashOf.has(slotKey(s)));
            return (
              <button
                key={d}
                type="button"
                aria-pressed={d === shownDay}
                onClick={() => setPicked(d)}
                className={cx(
                  'relative grid h-11 place-items-center rounded-lg text-xs font-semibold transition-colors',
                  d === shownDay ? 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-muted',
                )}
              >
                <span>
                  {DAY_LABELS[d]}
                  <span className="block text-2xs font-medium text-muted tabular-nums">
                    {count > 0 ? count : '·'}
                    <span className="sr-only"> sessions</span>
                  </span>
                </span>
                {clashing && (
                  <span className="absolute top-1 right-1 size-2 rounded-full bg-clash-certain">
                    <span className="sr-only">, has a clash</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div role="group" aria-label={`${TERM_LABELS[term]} term week`} className={cx(!narrow && 'min-w-[36rem]')}>
        <div className={cx('grid pb-2 text-2xs font-semibold text-muted', columns, narrow && 'sr-only')}>
          <span />
          {days.map((d) => (
            <span key={d} className="px-1.5">
              {DAY_LABELS[d]}
            </span>
          ))}
        </div>
        <div className={cx('relative grid h-[34rem] rounded-xl border border-line bg-canvas', columns)}>
          {/* Hour lines and labels */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {HOURS.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-line/70 first:border-0" style={{ top: `${(i / hourCount) * 100}%` }}>
                {i < hourCount && (
                  <span className="absolute top-1 left-2 text-2xs text-muted tabular-nums">{String(h).padStart(2, '0')}:00</span>
                )}
              </div>
            ))}
          </div>
          <span aria-hidden="true" />
          {days.map((day) => (
            <div key={day} className="relative border-l border-line/70" aria-label={DAY_NAMES[day]} role="group">
              {keepFree
                .filter((w) => w.day === day && dayOffset(toMinutes(w.to)) > dayOffset(toMinutes(w.from)))
                .map((w) => (
                  <div
                    key={`${w.from}-${w.to}`}
                    className="pointer-events-none absolute inset-x-0 bg-mode-explain/12 text-mode-explain"
                    style={{
                      top: `${dayOffset(toMinutes(w.from))}%`,
                      height: `${dayOffset(toMinutes(w.to)) - dayOffset(toMinutes(w.from))}%`,
                    }}
                  >
                    {/* The early-start band repeats every day, so only the first is labelled; the legend covers the rest. */}
                    {(w.reason !== 'early' || day === firstEarlyDay || narrow) && (
                      <span className="absolute top-0.5 right-1 inline-flex items-center gap-0.5 text-2xs font-semibold" aria-hidden="true">
                        <Icon name="moon" size={10} />
                        {w.reason === 'early' ? `Before ${w.to}` : 'Kept free'}
                      </span>
                    )}
                    <span className="sr-only">
                      {keepFreeLabel(w)}: you asked to keep this free
                    </span>
                  </div>
                ))}
              {layoutDay(slots.filter((s) => s.day === day)).map(({ slot, lane, lanes }) => {
                const start = toMinutes(slot.start);
                const end = toMinutes(slot.end);
                const clash = clashOf.get(slotKey(slot));
                const core = coreIds.has(slot.moduleId);
                const inKeptFree = keptFree.has(slotKey(slot));
                const colour = colourFor(slot.moduleId);
                return (
                  <div
                    key={slotKey(slot)}
                    className="absolute p-[3px]"
                    style={{
                      top: `${dayOffset(start)}%`,
                      height: `${dayOffset(end) - dayOffset(start)}%`,
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`,
                    }}
                  >
                    {/* An opaque underlay keeps kept-free shading and its label from showing through the tinted block. */}
                    <span aria-hidden="true" className="absolute inset-[3px] rounded-lg bg-canvas" />
                    <div
                      className={cx(
                        'animate-fade relative flex h-full flex-col overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5 text-2xs leading-tight',
                        core ? CORE_BLOCK : colour.block,
                        slot.provisional && 'border-y border-r border-dashed',
                        inKeptFree && 'outline-2 -outline-offset-2 outline-mode-explain outline-dashed',
                        clash && RING_CLASS[clash],
                      )}
                    >
                      <span className="flex items-center gap-1 truncate font-mono font-semibold">
                        {core && <Icon name="lock" size={10} className="shrink-0 text-muted" />}
                        <span className="truncate">{codeFor(slot.moduleId)}</span>
                        {inKeptFree && <Icon name="moon" size={10} className="ml-auto shrink-0 text-mode-explain" />}
                      </span>
                      <span className="truncate font-medium text-ink">{titleFor(slot.moduleId)}</span>
                      <span className="mt-auto truncate text-muted capitalize">
                        {core && 'Core · '}{slot.kind} · {slot.start}–{slot.end}
                      </span>
                      {slot.provisional && (
                        <span className="mt-0.5 inline-flex w-fit max-w-full items-center gap-0.5 truncate rounded-full border border-dashed border-current bg-surface px-1.5 text-2xs font-semibold text-ink">
                          Provisional · {Math.round(slot.probability * 100)}%
                          <span className="sr-only"> chance it runs at this time</span>
                        </span>
                      )}
                      <span className="sr-only">
                        {DAY_NAMES[day]}
                        {core ? ', core module' : ''}
                        {clash ? `, ${CLASH_LABELS[clash].toLowerCase()}` : ''}
                        {inKeptFree ? ', in time you asked to keep free' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
              {bands
                .filter((b) => b.day === day)
                .map((band) => (
                  <div
                    key={band.key}
                    className={cx(
                      'hatch pointer-events-none absolute inset-x-0 z-10 border-y border-dashed border-current',
                      CLASH_TEXT_CLASS[band.label],
                    )}
                    style={{ top: `${dayOffset(band.start)}%`, height: `${dayOffset(band.end) - dayOffset(band.start)}%` }}
                  >
                    <ClashMarker
                      variant={band.label}
                      probability={band.probability}
                      compact
                      className="absolute -top-2.5 -right-1.5 shadow-soft"
                    />
                    <span className="sr-only">
                      Overlap {formatRange(band.start, band.end)} on {DAY_NAMES[day]}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
