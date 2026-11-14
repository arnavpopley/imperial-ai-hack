// A Monday to Friday, 09:00 to 18:00 grid for one term. Provisional slots are dashed with their
// probability; overlaps between clashing slots are hatched and pinned with a clash marker.
import type { Clash, ClashLabel, Slot, Term } from '@modulematch/shared';
import { ClashMarker, CLASH_LABELS, CLASH_TEXT_CLASS } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { DAY_LABELS, DAY_NAMES, TERM_LABELS, WEEKDAYS } from '../labels.ts';
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
}

export function WeekGrid({ term, slots, clashes, colourFor, codeFor, titleFor }: WeekGridProps) {
  const bands = overlapBands(clashes, term);
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

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label={`${TERM_LABELS[term]} term week`} className="min-w-[36rem]">
        <div className="grid grid-cols-[3rem_repeat(5,minmax(0,1fr))] pb-2 text-[12px] font-semibold text-muted">
          <span />
          {WEEKDAYS.map((d) => (
            <span key={d} className="px-1.5">
              {DAY_LABELS[d]}
            </span>
          ))}
        </div>
        <div className="relative grid h-[34rem] grid-cols-[3rem_repeat(5,minmax(0,1fr))] rounded-xl border border-line bg-canvas">
          {/* Hour lines and labels */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {HOURS.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-line/70 first:border-0" style={{ top: `${(i / hourCount) * 100}%` }}>
                {i < hourCount && (
                  <span className="absolute top-1 left-2 text-[11px] text-muted tabular-nums">{String(h).padStart(2, '0')}:00</span>
                )}
              </div>
            ))}
          </div>
          <span aria-hidden="true" />
          {WEEKDAYS.map((day) => (
            <div key={day} className="relative border-l border-line/70" aria-label={DAY_NAMES[day]} role="group">
              {layoutDay(slots.filter((s) => s.day === day)).map(({ slot, lane, lanes }) => {
                const start = toMinutes(slot.start);
                const end = toMinutes(slot.end);
                const clash = clashOf.get(slotKey(slot));
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
                    <div
                      className={cx(
                        'animate-fade flex h-full flex-col overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5 text-[11px] leading-tight',
                        colour.block,
                        slot.provisional && 'border-y border-r border-dashed',
                        clash && RING_CLASS[clash],
                      )}
                    >
                      <span className="truncate font-mono font-semibold">{codeFor(slot.moduleId)}</span>
                      <span className="truncate font-medium text-ink">{titleFor(slot.moduleId)}</span>
                      <span className="mt-auto truncate text-muted capitalize">
                        {slot.kind} · {slot.start}–{slot.end}
                      </span>
                      {slot.provisional && (
                        <span className="mt-0.5 w-fit rounded bg-surface/80 px-1 text-[10px] font-semibold">
                          Provisional · {Math.round(slot.probability * 100)}%
                        </span>
                      )}
                      <span className="sr-only">
                        {DAY_NAMES[day]}
                        {clash ? `, ${CLASH_LABELS[clash].toLowerCase()}` : ''}
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
