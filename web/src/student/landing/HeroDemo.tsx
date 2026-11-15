// The landing hero (issue #135): the product itself, played once in about 2.7 seconds. A student's words become a
// profile interest, the interest lifts a module's fit ring, the reason cites "Your words", and a clash in a mini week
// resolves with a swap. Built from the real components (FitScore, Meter, ReasonRow, ClashMarker) and tokens, with
// no images. Under prefers-reduced-motion it shows the final frame at once.
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ClashMarker } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { FIT_BAND_LABELS, FitScore, fitBand } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Meter } from '../../components/Meter.tsx';
import { ReasonRow } from '../module/ReasonRow.tsx';

const QUOTE = 'I loved the control systems lab';
/**
 * About what the demo student's best match (Embedded C for Microcontrollers A) really scores, so the landing page
 * never promises a number the app does not produce (issue #105).
 */
export const HERO_FIT = 62;

/** When each beat starts, in seconds. The last one settles by about 2.7 s (the issue asks for 3 s or less). */
const BEATS = { quote: 0, interest: 0.9, card: 1.25, reason: 1.75, clash: 1.75, swap: 2.35 } as const;
const TYPE_SECONDS = 0.75;
const COUNT_SECONDS = 0.9;
const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Seconds since the demo started (once `started`), ticking on animation frames until the last beat has passed; the
 * final value at once when reduced. A plain requestAnimationFrame loop, so the landing chunk does not pull in motion's animate().
 */
function useClock(reduce: boolean, started: boolean): number {
  const end = BEATS.swap + 0.4;
  const [t, setT] = useState(reduce ? end : 0);
  useEffect(() => {
    if (reduce) {
      setT(end);
      return;
    }
    if (!started) return;
    let frame = 0;
    const origin = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(end, (now - origin) / 1000);
      setT(elapsed);
      if (elapsed < end) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, started, end]);
  return t;
}

const progress = (t: number, start: number, seconds: number) => Math.min(1, Math.max(0, (t - start) / seconds));
/** The same ease as the app's motion tokens, for values derived from the clock. */
const easeOut = (x: number) => 1 - (1 - x) ** 3;

export function HeroDemo({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  // The demo plays when it is first on screen: at once beside the headline on a laptop, and when the student
  // scrolls to it under the buttons on a phone.
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const t = useClock(reduce, inView);
  const typed = QUOTE.slice(0, Math.round(QUOTE.length * progress(t, BEATS.quote + 0.15, TYPE_SECONDS)));
  const typing = typed.length < QUOTE.length;
  const fit = Math.round(HERO_FIT * easeOut(progress(t, BEATS.card + 0.15, COUNT_SECONDS)));
  const show = (beat: keyof typeof BEATS) => t >= BEATS[beat];
  const swapped = show('swap');
  // Every beat keeps its space from the start and only fades in, so nothing below the hero moves.
  const beat = (on: boolean) => ({
    initial: false as const,
    animate: on ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
    transition: reduce ? { duration: 0 } : { duration: 0.4, ease: EASE },
  });

  return (
    <figure ref={ref} className={cx('relative mx-auto w-full max-w-lg', className)}>
      <figcaption className="sr-only">
        An example of ModuleMatch: a student says “{QUOTE}”, it becomes an interest in control and robotics, Embedded
        C for Microcontrollers A scores {HERO_FIT}, the reason quotes the student’s words, and a timetable clash is
        resolved with a swap.
      </figcaption>
      {/* A picture of the product, not part of the page's controls: inert keeps it out of the tab order. */}
      <div aria-hidden="true" inert className="overflow-hidden rounded-panel bg-surface shadow-lift ring-1 ring-line">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-2 text-2xs font-medium text-muted">ModuleMatch · example</span>
        </div>

        {/* min-w-0 on every row, so a long word or chip never widens the card past its column. */}
        <div className="grid gap-3 p-4 sm:p-5 [&>*]:min-w-0">
          {/* 1. The student's words, typed out as in the chat. */}
          <p className="relative ml-auto max-w-[88%] rounded-[1.25rem] rounded-br-md bg-brand px-4 py-2.5 text-sm leading-relaxed text-on-brand shadow-soft">
            {/* The whole quote sets the bubble's size; the typed part is drawn over it. */}
            <span className="invisible">“{QUOTE}”</span>
            <span className="absolute inset-0 px-4 py-2.5">
              “{typed}
              {typing && <span className="animate-caret">|</span>}
              {!typing && '”'}
            </span>
          </p>

          {/* 2. The words become a profile interest. */}
          <motion.div {...beat(show('interest'))} className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-3 py-2">
            <Icon name="sparkle" size={14} className="shrink-0 text-brand" />
            <span className="text-2xs font-semibold tracking-[0.08em] whitespace-nowrap text-muted uppercase">Drawn to</span>
            <span className="min-w-0 truncate text-sm font-medium">Control and robotics</span>
            <Meter value={show('card') ? 0.9 : 0.15} label="Interest in control and robotics" className="ml-auto w-12 shrink-0 sm:w-16" />
          </motion.div>

          {/* 3. A module card whose fit ring counts up, with the reason that cites the student's words. */}
          <motion.div {...beat(show('card'))} className="grid gap-3 rounded-2xl border border-line p-3 [&>*]:min-w-0">
            <div className="flex items-center gap-4">
              <FitScore value={fit} size="lg" />
              <div className="min-w-0">
                <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Your best match · example</p>
                <p className="mt-0.5 font-semibold tracking-tight">Embedded C for Microcontrollers A</p>
                <p className="text-xs text-muted">{FIT_BAND_LABELS[fitBand(HERO_FIT)]} · 5 ECTS · Spring</p>
              </div>
            </div>
            <motion.div {...beat(show('reason'))} className="grid min-w-0 gap-2">
              <ul>
                <ReasonRow
                  text="Covers control and robotics, which you said you enjoy."
                  source={{ variant: 'quote', quote: QUOTE, slotLabel: 'Interest: Control and robotics', confidence: 0.9 }}
                />
              </ul>
              {/* ReasonRow shows its "Your words" chip from sm up (phones open the row instead, which this picture
                  cannot do), so phones get the link to the student's words on its own line. */}
              <span className="inline-flex max-w-full min-w-0 items-center gap-1 justify-self-start rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted sm:hidden">
                <Icon name="chat" size={11} className="shrink-0" />
                <span className="truncate">Your words: “{QUOTE}”</span>
              </span>
            </motion.div>
          </motion.div>

          {/* 4. A clash in a mini week, cleared by a swap. */}
          <motion.div {...beat(show('clash'))} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Spring week</span>
              <AnimatePresence mode="wait" initial={false}>
                {swapped ? (
                  <motion.span
                    key="clear"
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-fit-high/12 px-2 text-2xs font-semibold text-fit-high"
                  >
                    <Icon name="check" size={12} />
                    No clashes
                  </motion.span>
                ) : (
                  <motion.span key="clash" exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
                    <ClashMarker variant="certain" />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <MiniWeek swapped={swapped} reduce={reduce} />
          </motion.div>
        </div>
      </div>
    </figure>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

/**
 * Two lectures that share Tuesday afternoon, then one moves to Thursday. A faithful, lightweight copy of the
 * timetable's week grid: day columns, module colours and the certain-clash hatch.
 */
function MiniWeek({ swapped, reduce }: { swapped: boolean; reduce: boolean }) {
  return (
    <div className="relative grid h-20 grid-cols-5 gap-1 text-center">
      {DAYS.map((day) => (
        <div key={day} className="rounded-lg bg-surface-2/60">
          <span className="block pt-1 text-2xs font-medium text-muted">{day}</span>
        </div>
      ))}
      {/* Embedded C stays on Tuesday 14:00. */}
      <Block row="top" className="border-module-1 bg-module-1/20 text-module-1" style={{ left: column(1), width: COLUMN }}>
        Embedded C
      </Block>
      {/* Mechatronics 3A overlaps it, then the swap moves it to Thursday. */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{ width: COLUMN }}
        initial={false}
        animate={{ x: swapped ? 'calc(300% + 0.75rem)' : 'calc(100% + 0.25rem)' }}
        transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
      >
        <Block row="low" className="inset-x-0 border-module-4 bg-module-4/20 text-module-4">
          Mechatronics
        </Block>
      </motion.div>
      <AnimatePresence initial={false}>
        {!swapped && (
          <motion.span
            key="hatch"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute top-[2.25rem] h-3 rounded-sm bg-[repeating-linear-gradient(135deg,var(--color-clash-certain)_0_3px,transparent_3px_6px)] opacity-70"
            style={{ left: column(1), width: COLUMN }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** One of five day columns, with the grid's 0.25 rem gaps. */
const COLUMN = 'calc((100% - 1rem) / 5)';
const column = (index: number) => `calc(${index} * ((100% - 1rem) / 5 + 0.25rem))`;

function Block({ row, className, style, children }: { row: 'top' | 'low'; className: string; style?: CSSProperties; children: string }) {
  return (
    <span
      className={cx(
        'absolute h-6 truncate rounded-md border-l-[3px] px-1 text-left text-2xs leading-6 font-semibold',
        row === 'top' ? 'top-6' : 'top-[2.25rem]',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
