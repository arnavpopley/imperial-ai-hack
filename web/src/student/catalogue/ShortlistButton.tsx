import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { Spinner } from '../../components/Spinner.tsx';
import { DURATION, EASE, useMotionTokens } from '../../motion/tokens.ts';

interface ShortlistButtonProps {
  title: string;
  shortlisted: boolean;
  pending: boolean;
  onToggle: () => void;
  /** md on cards, lg on the module page. */
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * A toggle button (aria-pressed) that adds a module to the shortlist or removes it. It reads as a proper
 * secondary button when off and fills with the brand colour when on, with the icon and label swapping in.
 *
 * Adding is celebrated (the skill's 600ms spring): the check lands with a little overshoot, then a soft
 * burst follows through around it. Removing is a gentle 200ms swap with no burst. Reduced motion swaps the
 * icon at once and skips the burst.
 */
export function ShortlistButton({ title, shortlisted, pending, onToggle, size = 'md', className }: ShortlistButtonProps) {
  const { reduce, transition } = useMotionTokens();
  // Celebrate only a new addition made while this button is on screen: not a module that was already
  // shortlisted when the page loaded, and not the check coming back after a removal that failed.
  const [previous, setPrevious] = useState({ shortlisted, pending });
  const [celebration, setCelebration] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  if (previous.shortlisted !== shortlisted || previous.pending !== pending) {
    setPrevious({ shortlisted, pending });
    if (shortlisted && !previous.shortlisted) {
      setCelebration((n) => n + 1);
      setCelebrating(true);
    } else if (pending && !previous.pending) {
      setCelebrating(false);
    }
  }

  const iconKey = pending ? 'pending' : shortlisted ? 'on' : 'off';
  const landing = iconKey === 'on' && celebrating;
  const swap = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        initial: landing ? { opacity: 0, scale: 0.4, y: 0 } : { opacity: 0, y: 4, scale: 0.9 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.9, transition: transition('answerFeedback') },
      };

  return (
    <motion.button
      type="button"
      aria-pressed={shortlisted}
      aria-label={`Shortlist ${title}`}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={onToggle}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={transition('answerFeedback')}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 disabled:cursor-wait',
        size === 'md' ? 'h-10 min-w-[8.5rem] px-4 text-sm' : 'h-12 min-w-[10.5rem] px-5 text-[15px]',
        shortlisted
          ? 'bg-brand text-on-brand shadow-soft hover:brightness-110'
          : 'border-2 border-brand/35 bg-surface text-brand hover:border-brand hover:bg-brand-soft/60',
        className,
      )}
    >
      <span className="relative grid size-[18px] place-items-center" aria-hidden="true">
        {/* Secondary action: the burst follows the check, behind it, and never takes pointer events. */}
        {landing && !reduce && <Burst key={celebration} />}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={iconKey}
            {...swap}
            transition={transition(landing ? 'correctCelebration' : 'answerFeedback')}
            className="absolute inset-0 grid place-items-center"
          >
            {pending ? <Spinner size={16} /> : <Icon name={shortlisted ? 'check' : 'plus'} size={18} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span aria-hidden="true">{shortlisted ? 'Shortlisted' : 'Add to shortlist'}</span>
    </motion.button>
  );
}

/** Six sparks travel out on gentle arcs and a ring opens, starting just after the check lands. */
const SPARKS = [0, 60, 120, 180, 240, 300] as const;
const SPARK_REACH = 13;
const FOLLOW_DELAY = 0.12;

function Burst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-current"
        initial={{ scale: 0.6, opacity: 0.7 }}
        animate={{ scale: 2.1, opacity: 0 }}
        transition={{ duration: DURATION.correctCelebration, ease: EASE.out, delay: FOLLOW_DELAY }}
      />
      {SPARKS.map((deg) => {
        const angle = (deg * Math.PI) / 180;
        // The midpoint sits a little off the straight line, so each spark curves (arc) on its way out.
        const bend = angle + 0.45;
        const x = Math.cos(angle) * SPARK_REACH;
        const y = Math.sin(angle) * SPARK_REACH;
        const midX = Math.cos(bend) * SPARK_REACH * 0.6;
        const midY = Math.sin(bend) * SPARK_REACH * 0.6;
        return (
          <motion.span
            key={deg}
            className="absolute top-1/2 left-1/2 -mt-[2px] -ml-[2px] size-1 rounded-full bg-current"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={{ x: [0, midX, x], y: [0, midY, y], opacity: [0, 1, 0], scale: [0.6, 1, 0.4] }}
            transition={{ duration: DURATION.correctCelebration, ease: EASE.out, delay: FOLLOW_DELAY }}
          />
        );
      })}
    </span>
  );
}
