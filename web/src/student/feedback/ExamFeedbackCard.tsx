// One exam's tailored feedback (spec 23): the summary, what went well, where marks went with the examiner's
// advice, a revision checklist kept in this browser, and the future modules that build on the same topics.
import type { ModuleResult, TailoredFeedback } from '@modulematch/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { AnimatedTick } from '../interview/InterviewTimeline.tsx';
import { topicLabel } from '../labels.ts';
import { paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { formatMarks, lostMarksRows, questionLabel, readChecked, revisionKey, toggleItem, writeChecked } from './plan.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;

interface ExamFeedbackCardProps {
  feedback: TailoredFeedback;
  /** The student's own result for this module, for question maximums on the bars. */
  result: ModuleResult | undefined;
  sessionId: string;
  index: number;
}

export function ExamFeedbackCard({ feedback, result, sessionId, index }: ExamFeedbackCardProps) {
  const { moduleById } = useReferenceData();
  const reduce = useReducedMotion();
  const headingId = useId();
  const module = moduleById.get(feedback.moduleId);
  const title = module?.title ?? result?.title ?? feedback.moduleId;

  return (
    <motion.article
      aria-labelledby={headingId}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.08, ease: EASE }}
      className="overflow-hidden rounded-panel bg-surface shadow-soft ring-1 ring-line"
    >
      <header className="relative grid gap-4 border-b border-line p-card sm:p-card-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-mode-explain/10 to-transparent"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              {module && <span className="font-mono text-[12px]">{module.code}</span>}
              <span>{feedback.examLabel}</span>
            </p>
            <h2 id={headingId} className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              <Link to={paths.module(feedback.moduleId)} className="rounded-sm hover:underline">
                {title}
              </Link>
            </h2>
          </div>
          <SourceTag source={feedback.source} />
        </div>
        <p className="relative max-w-3xl text-[15px] leading-relaxed text-pretty">{feedback.overall}</p>
        {feedback.strengths.length > 0 && (
          <ul className="relative flex flex-wrap gap-2" aria-label="What went well">
            {feedback.strengths.map((s) => (
              <li key={s} className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-fit-high/10 px-3 py-1.5 text-[13px] text-ink">
                <Icon name="check" size={13} className="mt-1 shrink-0 text-fit-high" />
                <span className="min-w-0">{s}</span>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="grid gap-x-8 gap-y-8 p-card sm:p-card-lg lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <WeakPoints feedback={feedback} result={result} />
        <div className="grid content-start gap-8">
          <RevisionPlan feedback={feedback} sessionId={sessionId} />
          <AffectsModules feedback={feedback} />
        </div>
      </div>
    </motion.article>
  );
}

function SourceTag({ source }: { source: TailoredFeedback['source'] }) {
  return (
    <span
      title={source === 'model' ? 'Written by AI from facts worked out by code' : 'Built from a template, from facts worked out by code'}
      className="relative inline-flex items-center gap-1 text-[11.5px] text-muted"
    >
      <Icon name={source === 'model' ? 'sparkle' : 'grid'} size={12} />
      {source === 'model' ? 'AI-written' : 'Template'}
    </span>
  );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
      {children}
    </h3>
  );
}

function WeakPoints({ feedback, result }: { feedback: TailoredFeedback; result: ModuleResult | undefined }) {
  const id = useId();
  const reduce = useReducedMotion();
  const rows = lostMarksRows(feedback.weakPoints, result);
  if (rows.length === 0)
    return (
      <section aria-labelledby={id} className="grid content-start gap-3">
        <SectionTitle id={id}>Where marks went</SectionTitle>
        <p className="text-[14px] text-muted">No question stood out. Keep doing what you did.</p>
      </section>
    );
  return (
    <section aria-labelledby={id} className="grid content-start gap-3">
      <SectionTitle id={id}>Where marks went</SectionTitle>
      <ol className="grid gap-3">
        {feedback.weakPoints.map((w, i) => {
          const row = rows[i];
          if (!row) return null;
          return (
            <li key={w.questionId} className="grid gap-2.5 rounded-2xl bg-surface-2/70 p-4 ring-1 ring-line ring-inset">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-semibold">{questionLabel(w.questionId)}</p>
                <p className="text-[13px] text-muted tabular-nums">
                  {row.maxMarks !== null
                    ? `${formatMarks(row.lost)} of ${formatMarks(row.maxMarks)} marks lost`
                    : `${formatMarks(row.lost)} marks lost`}
                </p>
              </div>
              <div
                role="img"
                aria-label={
                  row.maxMarks !== null
                    ? `${formatMarks(row.lost)} of ${formatMarks(row.maxMarks)} marks lost`
                    : `${formatMarks(row.lost)} marks lost`
                }
                className="flex h-2.5 overflow-hidden rounded-full bg-surface ring-1 ring-line ring-inset"
              >
                {row.scoredShare > 0 && (
                  <motion.span
                    className="h-full bg-brand/70"
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${row.scoredShare * 100}%` }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.06 }}
                  />
                )}
                <motion.span
                  className={cx('hatch h-full bg-fit-mid/20 text-fit-mid', row.maxMarks === null && 'rounded-full')}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${row.lostShare * 100}%` }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.25 + i * 0.06 }}
                />
              </div>
              {w.topics.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
                  {w.topics.map((t) => (
                    <li key={t} className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-medium text-muted ring-1 ring-line">
                      {topicLabel(t)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex gap-2 text-[14px] leading-relaxed">
                <Icon name="tutor" size={15} className="mt-1 shrink-0 text-mode-explain" />
                <span>
                  <span className="sr-only">Examiner's advice: </span>
                  {w.advice}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RevisionPlan({ feedback, sessionId }: { feedback: TailoredFeedback; sessionId: string }) {
  const id = useId();
  const key = revisionKey(sessionId, feedback.moduleId, feedback.examLabel);
  const [checked, setChecked] = useState(() => readChecked(key));
  const plan = feedback.revisionPlan;
  const done = plan.filter((item) => checked.includes(item)).length;
  if (plan.length === 0) return null;

  const toggle = (item: string) => {
    const next = toggleItem(checked, item, plan);
    setChecked(next);
    writeChecked(key, next);
  };

  return (
    <section aria-labelledby={id} className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle id={id}>Your revision plan</SectionTitle>
        <span className="text-[12px] text-muted tabular-nums" aria-live="polite">
          {done} of {plan.length} done
        </span>
      </div>
      <ul className="grid gap-1.5">
        {plan.map((item) => {
          const on = checked.includes(item);
          return (
            <li key={item}>
              <label
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-[14px] leading-snug transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                  on ? 'bg-fit-high/8' : 'hover:bg-surface-2',
                )}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(item)} className="sr-only" />
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-px grid size-5 shrink-0 place-items-center rounded-md transition',
                    on ? 'bg-fit-high text-on-brand' : 'bg-surface ring-1 ring-line-strong',
                  )}
                >
                  {on && <AnimatedTick size={12} />}
                </span>
                <span className={cx('transition-colors', on && 'text-muted line-through decoration-line-strong')}>{item}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-muted">Ticks are saved in this browser only.</p>
    </section>
  );
}

function AffectsModules({ feedback }: { feedback: TailoredFeedback }) {
  const id = useId();
  const { moduleById } = useReferenceData();
  if (feedback.affectsModules.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <SectionTitle id={id}>This affects</SectionTitle>
      <ul className="grid gap-2">
        {feedback.affectsModules.map((m) => {
          const module = moduleById.get(m.moduleId);
          return (
            <li key={m.moduleId}>
              <Link
                to={paths.module(m.moduleId)}
                className="group flex items-start gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line transition hover:shadow-soft hover:ring-line-strong"
              >
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon name="arrow-right" size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium group-hover:underline">{module?.title ?? m.moduleId}</span>
                  <span className="block text-[12.5px] leading-snug text-muted">{m.note}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
