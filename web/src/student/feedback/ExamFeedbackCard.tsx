// One exam's tailored feedback (spec 23), said once each: a headline naming where most marks went, the paper as a
// per-question chart, the examiner's advice on the focus questions, a revision checklist kept in this browser, and
// the future modules that build on the same topics. Collapsed, it is just the headline and the mini chart.
import type { TailoredFeedback } from '@modulematch/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { Provenance } from '../../components/Provenance.tsx';
import { AnimatedTick } from '../interview/InterviewTimeline.tsx';
import { topicLabel } from '../labels.ts';
import { paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { readChecked, revisionKey, toggleItem, writeChecked, type QuestionBar } from './plan.ts';
import { MiniBars, QuestionChart } from './QuestionChart.tsx';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** "This affects" shows this many modules at first, so a long list does not crowd the card. */
const AFFECTS_SHOWN = 3;

export interface ExamView {
  feedback: TailoredFeedback;
  bars: QuestionBar[];
  mark: number | null;
  /** Share of the paper's marks lost, 0 to 1; the page lists the biggest gap first. */
  gap: number;
  anchor: string;
}

interface ExamFeedbackCardProps {
  exam: ExamView;
  sessionId: string;
  open: boolean;
  onToggle: () => void;
  index: number;
}

export function ExamFeedbackCard({ exam, sessionId, open, onToggle, index }: ExamFeedbackCardProps) {
  const { feedback, bars, mark, anchor } = exam;
  const { moduleById } = useReferenceData();
  const reduce = useReducedMotion();
  const bodyId = useId();
  const chartId = useId();
  const ticks = useRevisionTicks(feedback, sessionId);
  const module = moduleById.get(feedback.moduleId);
  const title = module?.title ?? feedback.moduleId;

  return (
    <motion.article
      id={anchor}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.06, ease: EASE }}
      className="scroll-mt-24 overflow-hidden rounded-panel bg-surface shadow-soft ring-1 ring-line"
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-surface-2/50 sm:gap-5 sm:p-6"
        >
          <MarkBadge mark={mark} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] text-muted">
              {module && <span className="font-mono">{module.code} · </span>}
              {feedback.examLabel}
            </span>
            <span className="mt-0.5 block text-lg leading-snug font-semibold tracking-tight">{title}</span>
            <span className="mt-1 block text-[13.5px] leading-snug text-muted">{feedback.overall}</span>
          </span>
          <MiniBars bars={bars} className="shrink-0 max-sm:hidden" />
          <Icon
            name="chevron-down"
            size={18}
            className={cx('shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </h2>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid gap-x-8 gap-y-7 border-t border-line p-5 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="grid content-start gap-7">
                {bars.length > 0 && (
                  <section className="grid gap-3">
                    <SectionTitle id={chartId}>Your paper</SectionTitle>
                    <QuestionChart bars={bars} headingId={chartId} />
                  </section>
                )}
                <FocusPoints feedback={feedback} />
              </div>
              <div className="grid content-start gap-7">
                <Strengths strengths={feedback.strengths} />
                <RevisionPlan plan={feedback.revisionPlan} checked={ticks.checked} onToggle={ticks.toggle} />
                <AffectsModules feedback={feedback} />
                <p className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                  <SourceTag source={feedback.source} />
                  <Link to={paths.module(feedback.moduleId)} className="font-medium text-brand underline-offset-2 hover:underline">
                    {title} module page
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/** The overall mark, calm and neutral: a fact about the student, not a verdict. */
export function MarkBadge({ mark, size = 'md' }: { mark: number | null; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'grid shrink-0 place-content-center rounded-2xl bg-brand-soft text-center text-brand',
        size === 'md' ? 'size-14' : 'size-11',
      )}
    >
      <span className={cx('leading-none font-semibold tabular-nums', size === 'md' ? 'text-xl' : 'text-base')}>
        {mark === null ? '–' : Math.round(mark)}
      </span>
      <span className="text-[10px] leading-tight font-medium text-brand/70">{mark === null ? 'mark' : '/100'}</span>
    </span>
  );
}

/** Written by the AI from the examiner's notes, or, offline, put together by code from them (issue #138). */
function SourceTag({ source }: { source: TailoredFeedback['source'] }) {
  return <Provenance kind={source === 'model' ? 'ai' : 'code'} />;
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
      {children}
    </h3>
  );
}

/** The focus questions: their subject and topics, and the examiner's advice. The marks are in the chart above. */
function FocusPoints({ feedback }: { feedback: TailoredFeedback }) {
  const id = useId();
  if (feedback.weakPoints.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid content-start gap-3">
      <SectionTitle id={id}>Where to focus</SectionTitle>
      <ol className="grid gap-2.5">
        {feedback.weakPoints.map((w) => (
          <li key={w.questionId} className="grid gap-2 rounded-2xl bg-fit-mid/6 p-4 ring-1 ring-fit-mid/20 ring-inset">
            <p className="flex flex-wrap items-baseline gap-x-2 font-semibold leading-snug">
              <span className="font-mono text-[13px]">{w.questionId}</span>
              {w.label && <span>{w.label}</span>}
            </p>
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
              <Icon name="tutor" size={15} className="mt-1 shrink-0 text-brand" />
              <span>
                <span className="sr-only">Examiner's advice: </span>
                {w.advice}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Strengths({ strengths }: { strengths: readonly string[] }) {
  const id = useId();
  if (strengths.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-2.5">
      <SectionTitle id={id}>Went well</SectionTitle>
      <ul className="flex flex-wrap gap-2">
        {strengths.map((s) => (
          <li key={s} className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-fit-high/10 px-3 py-1.5 text-[13px] text-ink">
            <Icon name="check" size={13} className="mt-1 shrink-0 text-fit-high" />
            <span className="min-w-0">{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The checklist's ticks, held by the card rather than the collapsible body, so closing and reopening a card keeps
 * them even when browser storage is blocked and the saved copy cannot be read back.
 */
function useRevisionTicks(feedback: TailoredFeedback, sessionId: string) {
  const key = revisionKey(sessionId, feedback.moduleId, feedback.examLabel);
  const [checked, setChecked] = useState(() => readChecked(key));
  const toggle = (item: string) => {
    const next = toggleItem(checked, item, feedback.revisionPlan);
    setChecked(next);
    writeChecked(key, next);
  };
  return { checked, toggle };
}

function RevisionPlan({ plan, checked, onToggle }: { plan: readonly string[]; checked: readonly string[]; onToggle: (item: string) => void }) {
  const id = useId();
  const done = plan.filter((item) => checked.includes(item)).length;
  if (plan.length === 0) return null;

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
                <input type="checkbox" checked={on} onChange={() => onToggle(item)} className="sr-only" />
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
  const listId = useId();
  const { moduleById } = useReferenceData();
  const [all, setAll] = useState(false);
  const list = feedback.affectsModules;
  if (list.length === 0) return null;
  const hidden = list.length - AFFECTS_SHOWN;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <SectionTitle id={id}>This affects</SectionTitle>
      <ul id={listId} className="grid gap-2">
        {(all ? list : list.slice(0, AFFECTS_SHOWN)).map((m) => {
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
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={all}
          aria-controls={listId}
          onClick={() => setAll((v) => !v)}
          className="justify-self-start rounded-lg text-[13px] font-medium text-brand hover:underline"
        >
          {all ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </section>
  );
}
