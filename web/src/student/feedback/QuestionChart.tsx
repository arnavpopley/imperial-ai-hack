// The exam at a glance: one bar per question, marks scored in brand colour and marks lost hatched in amber.
// "mini" is a row of small columns for the summary strip; "full" is a labelled chart inside an exam card.
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../../components/cx.ts';
import { formatMarks, questionLabel, type QuestionBar } from './plan.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** "Q1 15 of 20, Q3 6 of 20 (most marks lost)": the chart in words, for screen readers. */
export function chartLabel(bars: readonly QuestionBar[]): string {
  return bars
    .map((b) => `${questionLabel(b.questionId)}${b.label ? `, ${b.label}` : ''}: ${formatMarks(b.mark)} of ${formatMarks(b.maxMarks)}${b.weak ? ', a focus' : ''}`)
    .join('; ');
}

/** Small columns, one per question, each as tall as the question's maximum allows. */
export function MiniBars({ bars, className }: { bars: readonly QuestionBar[]; className?: string }) {
  if (bars.length === 0) return null;
  return (
    <span role="img" aria-label={chartLabel(bars)} className={cx('flex h-9 items-end gap-[3px]', className)}>
      {bars.map((b) => (
        <span
          key={b.questionId}
          aria-hidden="true"
          className={cx('hatch relative h-full w-2 overflow-hidden rounded-[3px] bg-fit-mid/15', b.weak ? 'text-fit-mid' : 'text-fit-mid/40')}
        >
          <span className="absolute inset-x-0 bottom-0 rounded-[3px] bg-brand/75" style={{ height: `${b.scoredShare * 100}%` }} />
        </span>
      ))}
    </span>
  );
}

/** A labelled bar per question: the focus questions stand out, the rest stay quiet. */
export function QuestionChart({ bars, headingId }: { bars: readonly QuestionBar[]; headingId: string }) {
  const reduce = useReducedMotion();
  if (bars.length === 0) return null;
  return (
    <div className="grid gap-2.5">
      <ol aria-labelledby={headingId} className="grid gap-2">
        {bars.map((b, i) => (
          <li key={b.questionId} className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.75rem] items-end gap-x-3 gap-y-1">
            <span className={cx('font-mono text-[12px] leading-none font-semibold', b.weak ? 'text-ink' : 'text-muted')}>{b.questionId}</span>
            <span className="grid min-w-0 gap-1">
              {b.label && (
                <span className={cx('truncate text-[12.5px] leading-tight', b.weak ? 'font-medium text-ink' : 'text-muted')}>{b.label}</span>
              )}
              <span
                role="img"
                aria-label={`${questionLabel(b.questionId)}: ${formatMarks(b.mark)} of ${formatMarks(b.maxMarks)} marks`}
                className="flex h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ring-inset"
              >
                <motion.span
                  className="h-full bg-brand/75"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${b.scoredShare * 100}%` }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.05 + i * 0.04 }}
                />
                <motion.span
                  className={cx('hatch h-full bg-fit-mid/15', b.weak ? 'text-fit-mid' : 'text-fit-mid/45')}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${b.lostShare * 100}%` }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.04 }}
                />
              </span>
            </span>
            <span className={cx('text-right text-[12.5px] leading-none tabular-nums', b.weak ? 'font-semibold text-ink' : 'text-muted')}>
              {formatMarks(b.mark)}/{formatMarks(b.maxMarks)}
            </span>
          </li>
        ))}
      </ol>
      <p aria-hidden="true" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-brand/75" /> Scored
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="hatch h-2 w-3 rounded-sm bg-fit-mid/15 text-fit-mid" /> Lost
        </span>
      </p>
    </div>
  );
}
