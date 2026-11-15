// The interview's progress as a vertical timeline (large screens) or a compact bar (phones).
// The current step glows, done steps tick, and the optional extras (CV, societies) sit at the end.
//
// Motion uses the education skill's tokens (web/src/motion/tokens.ts): a step ticks on the 200ms feedback
// clock, the connector fills as a 300ms progress update, and when the profile is complete a single
// "achievement unlock" (800ms bounce) says so warmly. The unlock waits for the last tick, so only one thing
// moves at a time. Reduced motion changes state at once, and the unlock only fades in.
import type { SessionState } from '@modulematch/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { ACHIEVEMENT_BOUNCE, DURATION, EASE, FADE_ONLY, INSTANT, MOTION, useMotionTokens } from '../../motion/tokens.ts';
import type { ResultsStepStatus } from '../results/resultsStep.ts';
import { buildTimeline, type StepStatus, type TimelineExtra, type TimelineStep } from './timeline.ts';
import './interview.css';

interface InterviewTimelineProps {
  session: SessionState;
  extras: readonly TimelineExtra[];
  /** The extra whose panel is open, if any. */
  activeExtra: TimelineExtra['id'] | null;
  onOpenExtra: (id: TimelineExtra['id']) => void;
  /** The optional "Your results" step at the start of the interview (spec 23). */
  results?: ResultsStep;
  className?: string;
}

export interface ResultsStep {
  status: ResultsStepStatus;
  /** True while the results panel is open. */
  active: boolean;
  onOpen: () => void;
}

const RESULTS_STATUS_TEXT: Record<ResultsStepStatus, string> = {
  done: 'Marks shared',
  skipped: 'Skipped for now',
  todo: 'Optional, recommended',
};

const STATUS_TEXT: Record<StepStatus, string> = { done: 'done', current: 'in progress', upcoming: 'not started' };

/** The interview has nothing left to ask, or the student has confirmed the profile. */
const isProfileReady = (session: SessionState) => session.interview.finished || session.interview.confirmed;

export function InterviewTimeline({ session, extras, activeExtra, onOpenExtra, results, className }: InterviewTimelineProps) {
  const steps = buildTimeline(session);
  const { reduce, transition } = useMotionTokens();
  return (
    <nav aria-label="Interview progress" className={className}>
      <ol className="grid">
        {results && <ResultsTimelineItem step={results} />}
        {steps.map((step, index) => (
          <motion.li
            key={step.id}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={transition('lessonTransition', index * 0.05)}
            aria-current={step.status === 'current' ? 'step' : undefined}
            className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-5"
          >
            <Connector done={step.status === 'done'} />
            <StepNode status={step.status} icon={step.icon} />
            <div className="min-w-0 pt-1">
              <p
                className={cx(
                  'text-sm leading-tight transition-colors',
                  step.status === 'current'
                    ? 'font-semibold text-ink'
                    : step.status === 'done'
                      ? 'text-ink'
                      : 'text-muted',
                )}
              >
                {step.label}
                <span className="sr-only">, {STATUS_TEXT[step.status]}</span>
              </p>
              {step.children && (
                <ul className="mt-2 grid gap-1.5">
                  {step.children.map((child) => (
                    <li key={child.id} className="flex items-center gap-2 text-xs">
                      <SubDot status={child.status} />
                      <span
                        className={cx(
                          child.status === 'upcoming' ? 'text-muted' : 'text-ink',
                          child.status === 'current' && 'font-medium',
                        )}
                      >
                        {child.label}
                        <span className="sr-only">, {STATUS_TEXT[child.status]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.li>
        ))}
      </ol>

      <ProfileReady ready={isProfileReady(session)} className="mb-4" />

      <p className="mt-1 mb-2.5 pl-[2.75rem] text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
        Optional
      </p>
      <ul className="grid gap-1">
        {extras.map((extra) => (
          <li key={extra.id}>
            <button
              type="button"
              onClick={() => onOpenExtra(extra.id)}
              aria-pressed={activeExtra === extra.id}
              className={cx(
                'group grid w-full grid-cols-[2rem_1fr] items-center gap-x-3 rounded-xl py-1.5 pr-2 text-left transition',
                activeExtra === extra.id ? 'bg-brand-soft' : 'hover:bg-surface-2',
              )}
            >
              <span
                className={cx(
                  'grid size-8 place-items-center rounded-full border border-dashed transition',
                  extra.done
                    ? 'border-transparent bg-fit-high text-on-brand'
                    : 'border-line-strong text-muted group-hover:border-brand group-hover:text-brand',
                )}
              >
                {extra.done ? <AnimatedTick /> : <Icon name={extra.icon} size={14} />}
              </span>
              <span className="text-sm">
                {extra.label}
                {extra.done && <span className="sr-only">, done</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Your results": optional but recommended, so it opens its panel instead of waiting for a question. */
function ResultsTimelineItem({ step }: { step: ResultsStep }) {
  const done = step.status === 'done';
  const { reduce, transition } = useMotionTokens();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={transition('lessonTransition')}
      className="relative pb-5"
    >
      <Connector done={step.status !== 'todo'} />
      <button
        type="button"
        onClick={step.onOpen}
        aria-pressed={step.active}
        className={cx(
          'group -my-1 -ml-1 grid w-[calc(100%+0.25rem)] grid-cols-[2rem_1fr] items-start gap-x-3 rounded-xl py-1 pr-2 pl-1 text-left transition',
          step.active ? 'bg-brand-soft' : 'hover:bg-surface-2',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'relative grid size-8 place-items-center rounded-full transition-colors duration-300',
            done && 'bg-brand text-on-brand',
            step.status === 'skipped' && 'border border-dashed border-line-strong bg-surface text-muted',
            step.status === 'todo' && 'bg-surface text-brand ring-2 ring-brand/50 ring-offset-0 group-hover:ring-brand',
          )}
        >
          {done ? <AnimatedTick /> : <Icon name="sheet" size={14} />}
        </span>
        <span className="min-w-0 pt-0.5">
          <span className="block text-sm leading-tight text-ink">Your results</span>
          <span
            aria-hidden="true"
            className={cx(
              'mt-1 inline-block rounded-full text-2xs font-semibold',
              step.status === 'todo' ? 'bg-brand-soft px-1.5 py-px text-brand' : 'text-muted',
            )}
          >
            {step.status === 'todo' ? 'Optional · recommended' : RESULTS_STATUS_TEXT[step.status]}
          </span>
          <span className="sr-only">, {RESULTS_STATUS_TEXT[step.status]}</span>
        </span>
      </button>
    </motion.li>
  );
}

/** The line down to the next step, filled in brand colour once this step is done. */
function Connector({ done }: { done: boolean }) {
  const { transition } = useMotionTokens();
  return (
    <span aria-hidden="true" className="absolute top-9 bottom-1 left-[15px] w-0.5 overflow-hidden rounded-full bg-line">
      <motion.span
        className="block w-full bg-brand"
        initial={false}
        animate={{ height: done ? '100%' : '0%' }}
        transition={transition('progressUpdate')}
      />
    </span>
  );
}

function StepNode({ status, icon }: { status: StepStatus; icon: TimelineStep['icon'] }) {
  const { reduce, transition } = useMotionTokens();
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative grid size-8 place-items-center rounded-full transition-colors duration-300',
        status === 'done' && 'bg-brand text-on-brand',
        status === 'current' && 'mm-pulse bg-surface text-brand ring-2 ring-brand',
        status === 'upcoming' && 'bg-surface-2 text-muted opacity-70',
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === 'done' ? (
          <motion.span
            key="done"
            initial={reduce ? false : { scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={transition('answerFeedback')}
          >
            <AnimatedTick />
          </motion.span>
        ) : (
          <motion.span
            key="icon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition('answerFeedback')}
          >
            <Icon name={icon} size={14} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function SubDot({ status }: { status: StepStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-4 shrink-0 place-items-center rounded-full transition-colors',
        status === 'done' && 'bg-brand text-on-brand',
        status === 'current' && 'mm-pulse relative bg-surface ring-2 ring-brand',
        status === 'upcoming' && 'bg-surface-2 ring-1 ring-line-strong',
      )}
    >
      {status === 'done' && <AnimatedTick size={10} />}
    </span>
  );
}

/** A check mark that draws itself on the 200ms feedback clock; under reduced motion it is simply there. */
export function AnimatedTick({ size = 14 }: { size?: number }) {
  const { reduce, transition } = useMotionTokens();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={transition('answerFeedback')}
      />
    </svg>
  );
}

/**
 * The achievement moment: when the profile becomes complete during this visit, a warm message bounces in
 * (800ms custom bounce) after the last step has ticked, with a soft halo as its secondary action. A profile
 * that was already complete when the page opened shows the message without the bounce. The live region is
 * always mounted so screen readers hear the message; nothing takes focus or blocks the page.
 */
function ProfileReady({ ready, className }: { ready: boolean; className?: string }) {
  const { reduce } = useMotionTokens();
  const [wasReady, setWasReady] = useState(ready);
  const [unlocked, setUnlocked] = useState(false);
  if (wasReady !== ready) {
    setWasReady(ready);
    setUnlocked(ready);
  }
  // Staging: the final step ticks first, and the chat's "here is what I heard" summary draws in at the same
  // moment (about a second). The unlock waits for both, so only one thing has the stage at a time.
  const delay = DURATION.answerFeedback + DURATION.achievementUnlock;
  const celebrate = unlocked && !reduce;

  return (
    // While empty the region stays in the accessibility tree but takes no space in the layout.
    <div role="status" className={ready ? className : 'sr-only'}>
      <AnimatePresence initial={false}>
        {ready && (
          <motion.div
            key="ready"
            initial={celebrate ? { opacity: 0, scale: ACHIEVEMENT_BOUNCE[0] } : unlocked ? { opacity: 0 } : false}
            animate={celebrate ? { opacity: 1, scale: [...ACHIEVEMENT_BOUNCE] } : { opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: reduce ? INSTANT : MOTION.answerFeedback }}
            transition={
              celebrate
                ? { scale: { ...MOTION.achievementUnlock, delay }, opacity: { ...MOTION.answerFeedback, delay } }
                : unlocked
                  ? FADE_ONLY
                  : INSTANT
            }
            className="relative flex items-center gap-3 rounded-2xl border border-fit-high/30 bg-fit-high/8 px-3 py-2.5"
          >
            {celebrate && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-fit-high/40"
                initial={{ opacity: 0.8, scale: 1 }}
                animate={{ opacity: 0, scale: 1.08 }}
                transition={{
                  duration: DURATION.achievementUnlock * 0.6,
                  ease: EASE.out,
                  delay: delay + DURATION.achievementUnlock * 0.4,
                }}
              />
            )}
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-fit-high text-on-brand">
              <Icon name="sparkle" size={15} />
            </span>
            <span className="min-w-0 text-xs leading-snug">
              <span className="block font-semibold text-ink">Profile ready: your matches are waiting</span>
              <span className="block text-muted">Check your profile, then see what fits.</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Phones: one line of progress with the current step's name, and the extras as small buttons. */
export function InterviewProgressBar({ session, extras, activeExtra, onOpenExtra, results, className }: InterviewTimelineProps) {
  const steps = buildTimeline(session).flatMap((s) => s.children ?? [s]);
  const current = steps.find((s) => s.status === 'current');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const { transition } = useMotionTokens();
  return (
    <div className={cx('grid gap-2.5', className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate">
          <span className="text-muted">Now: </span>
          <span className="font-semibold">
            {current?.label ??
              (session.interview.finished
                ? 'All done'
                : session.interview.askedSteps.length > 0
                  ? 'A few more questions'
                  : 'Getting started')}
          </span>
        </span>
        <span className="shrink-0 text-muted tabular-nums">
          {doneCount} of {steps.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Interview progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        className="flex h-2 gap-1"
      >
        {steps.map((step) => (
          <span key={step.id} className="relative flex-1 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              className={cx(
                'absolute inset-y-0 left-0 rounded-full',
                step.status === 'current' ? 'bg-brand/45' : 'bg-brand',
              )}
              initial={false}
              animate={{ width: step.status === 'upcoming' ? '0%' : '100%' }}
              transition={transition('progressUpdate')}
            />
          </span>
        ))}
      </div>
      <ProfileReady ready={isProfileReady(session)} />
      <div className="flex flex-wrap gap-2">
        {results && (
          <button
            type="button"
            onClick={results.onOpen}
            aria-pressed={results.active}
            className={cx(
              'flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition',
              results.active ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-ink',
            )}
          >
            {results.status === 'done' ? (
              <Icon name="check" size={13} className="text-fit-high" />
            ) : (
              <Icon name="sheet" size={13} className="text-brand" />
            )}
            Your results
            <span className="sr-only">, {RESULTS_STATUS_TEXT[results.status]}</span>
          </button>
        )}
        {extras.map((extra) => (
          <button
            key={extra.id}
            type="button"
            onClick={() => onOpenExtra(extra.id)}
            aria-pressed={activeExtra === extra.id}
            className={cx(
              'flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition',
              activeExtra === extra.id ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-ink',
            )}
          >
            <Icon
              name={extra.done ? 'check' : extra.icon}
              size={13}
              className={extra.done ? 'text-fit-high' : undefined}
            />
            {extra.label}
          </button>
        ))}
      </div>
    </div>
  );
}
