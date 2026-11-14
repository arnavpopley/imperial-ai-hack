// The interview's progress as a vertical timeline (large screens) or a compact bar (phones).
// The current step glows, done steps tick, and the optional extras (CV, societies) sit at the end.
import type { SessionState } from '@modulematch/shared';
import { AnimatePresence, motion } from 'motion/react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { buildTimeline, type StepStatus, type TimelineExtra, type TimelineStep } from './timeline.ts';
import './interview.css';

interface InterviewTimelineProps {
  session: SessionState;
  extras: readonly TimelineExtra[];
  /** The extra whose panel is open, if any. */
  activeExtra: TimelineExtra['id'] | null;
  onOpenExtra: (id: TimelineExtra['id']) => void;
  className?: string;
}

const STATUS_TEXT: Record<StepStatus, string> = { done: 'done', current: 'in progress', upcoming: 'not started' };

export function InterviewTimeline({ session, extras, activeExtra, onOpenExtra, className }: InterviewTimelineProps) {
  const steps = buildTimeline(session);
  return (
    <nav aria-label="Interview progress" className={className}>
      <ol className="grid">
        {steps.map((step, index) => (
          <motion.li
            key={step.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            aria-current={step.status === 'current' ? 'step' : undefined}
            className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-5"
          >
            <Connector done={step.status === 'done'} />
            <StepNode status={step.status} icon={step.icon} />
            <div className="min-w-0 pt-1">
              <p
                className={cx(
                  'text-[14px] leading-tight transition-colors',
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
                    <li key={child.id} className="flex items-center gap-2 text-[12.5px]">
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

      <p className="mt-1 mb-2.5 pl-[2.75rem] text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
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
              <span className="text-[14px]">
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

/** The line down to the next step, filled in brand colour once this step is done. */
function Connector({ done }: { done: boolean }) {
  return (
    <span aria-hidden="true" className="absolute top-9 bottom-1 left-[15px] w-0.5 overflow-hidden rounded-full bg-line">
      <motion.span
        className="block w-full bg-brand"
        initial={false}
        animate={{ height: done ? '100%' : '0%' }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </span>
  );
}

function StepNode({ status, icon }: { status: StepStatus; icon: TimelineStep['icon'] }) {
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
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            <AnimatedTick />
          </motion.span>
        ) : (
          <motion.span key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

/** A check mark that draws itself. */
export function AnimatedTick({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
      />
    </svg>
  );
}

/** Phones: one line of progress with the current step's name, and the extras as small buttons. */
export function InterviewProgressBar({ session, extras, activeExtra, onOpenExtra, className }: InterviewTimelineProps) {
  const steps = buildTimeline(session).flatMap((s) => s.children ?? [s]);
  const current = steps.find((s) => s.status === 'current');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  return (
    <div className={cx('grid gap-2.5', className)}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate">
          <span className="text-muted">Now: </span>
          <span className="font-semibold">
            {current?.label ?? (session.interview.finished ? 'All done' : 'Getting started')}
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
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {extras.map((extra) => (
          <button
            key={extra.id}
            type="button"
            onClick={() => onOpenExtra(extra.id)}
            aria-pressed={activeExtra === extra.id}
            className={cx(
              'flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition',
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
