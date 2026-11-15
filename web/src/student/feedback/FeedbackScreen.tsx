// "Your exam feedback" (spec 23): for each exam with a published examiner form and the student's own question
// marks, feedback tailored to those marks. Visible to the student only. An at-a-glance strip lists every exam with
// its mark and a mini chart, most marks lost first; the cards follow in the same order, only the first one open.
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { errorStatus } from '../results/files.ts';
import { MarkSheetIcon } from '../results/icons.tsx';
import { useResults } from '../results/ResultsProvider.tsx';
import { OPEN_RESULTS_STATE, paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { AwaitingMarks } from './AwaitingMarks.tsx';
import { ExamFeedbackCard, MarkBadge, type ExamView } from './ExamFeedbackCard.tsx';
import { byGap, examAnchor, examGap, examMark, questionBars } from './plan.ts';
import { MiniBars } from './QuestionChart.tsx';

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function FeedbackScreen() {
  const { session } = useReadySession();
  const { feedback, results, awaiting } = useResults();
  const reduce = useReducedMotion();
  // A 404 means the route is not deployed yet: show the empty state rather than an error.
  const failed = feedback.error !== null && errorStatus(feedback.error) !== 404 && !feedback.data;
  const loading = feedback.loading && !feedback.data;

  const exams = useMemo<ExamView[]>(() => {
    const views = (feedback.data ?? []).map((item) => {
      const result = results.data?.results.find((r) => r.moduleId === item.moduleId);
      const bars = questionBars(item, result);
      const mark = examMark(item, result);
      return { feedback: item, bars, mark, gap: examGap(bars, mark), anchor: examAnchor(item.moduleId, item.examLabel) };
    });
    return byGap(views);
  }, [feedback.data, results.data]);

  // Only the exam with most room to improve starts open; null means "not touched yet".
  const [openSet, setOpenSet] = useState<ReadonlySet<string> | null>(null);
  const isOpen = (anchor: string) => (openSet ? openSet.has(anchor) : anchor === exams[0]?.anchor);
  const setOpen = (anchor: string, open: boolean) =>
    setOpenSet((current) => {
      const next = new Set(current ?? (exams[0] ? [exams[0].anchor] : []));
      if (open) next.add(anchor);
      else next.delete(anchor);
      return next;
    });

  const jumpTo = (anchor: string) => {
    setOpen(anchor, true);
    // After the card has opened, bring it into view and move focus to its heading button.
    window.requestAnimationFrame(() => {
      const card = document.getElementById(anchor);
      card?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      card?.querySelector<HTMLButtonElement>('h2 button')?.focus({ preventScroll: true });
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3"
        >
          <div className="grid gap-1.5">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-mode-explain">
              <Icon name="lock" size={15} /> Only you can see this
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your exam feedback</h1>
            <p className="text-base text-muted text-pretty">Feedback from your examiner's notes, tailored to your marks.</p>
          </div>
          <SampleDataLabel variant="marks" />
        </motion.header>

        {loading && (
          <div className="grid gap-4" role="status" aria-label="Loading your feedback">
            <Skeleton className="h-40 w-full rounded-panel" />
            <Skeleton className="h-24 w-full rounded-panel" />
          </div>
        )}
        {failed && <ErrorState title="Your feedback did not load" message={feedback.error ?? ''} onRetry={feedback.reload} />}
        {!loading && <AwaitingMarks exams={awaiting.data ?? []} />}
        {/* A failed check for waiting feedback says so, rather than hiding it; a 404 means the route is not deployed. */}
        {!loading && awaiting.error !== null && errorStatus(awaiting.error) !== 404 && (
          <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            We could not check for feedback waiting on your question marks.
            <button type="button" onClick={awaiting.reload} className="font-semibold text-brand underline-offset-2 hover:underline">
              Try again
            </button>
          </p>
        )}
        {!loading && !failed && exams.length === 0 && <EmptyFeedback />}
        {exams.length > 1 && <AtAGlance exams={exams} onJump={jumpTo} />}
        {exams.map((exam, index) => (
          <ExamFeedbackCard
            key={exam.anchor}
            exam={exam}
            sessionId={session.id}
            open={isOpen(exam.anchor)}
            onToggle={() => setOpen(exam.anchor, !isOpen(exam.anchor))}
            index={index}
          />
        ))}
      </div>
    </MotionConfig>
  );
}

/** Every exam on one card: mark, mini chart and the question to focus on, most room to improve first. */
function AtAGlance({ exams, onJump }: { exams: readonly ExamView[]; onJump: (anchor: string) => void }) {
  const { moduleById } = useReferenceData();
  return (
    <motion.section
      aria-labelledby="glance-heading"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
      className="rounded-panel bg-surface p-2 shadow-soft ring-1 ring-line sm:p-3"
    >
      <h2 id="glance-heading" className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 pt-2 pb-1">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">At a glance</span>
        <span className="text-[12px] text-muted">Most room to improve first</span>
      </h2>
      <ol className="grid grid-cols-[minmax(0,1fr)]">
        {exams.map((exam) => {
          const focus = exam.feedback.weakPoints[0];
          const title = moduleById.get(exam.feedback.moduleId)?.title ?? exam.feedback.moduleId;
          return (
            <li key={exam.anchor}>
              <button
                type="button"
                onClick={() => onJump(exam.anchor)}
                className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface-2 sm:gap-4"
              >
                <MarkBadge mark={exam.mark} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{title}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {focus ? `Focus: ${focus.questionId}${focus.label ? ` ${focus.label}` : ''}` : 'A strong paper all round'}
                  </span>
                </span>
                <MiniBars bars={exam.bars} />
                <Icon name="arrow-down" size={15} className="shrink-0 text-muted transition group-hover:text-ink max-sm:hidden" />
                <span className="sr-only">, show this exam</span>
              </button>
            </li>
          );
        })}
      </ol>
    </motion.section>
  );
}

const HOW: readonly { icon: IconName | 'sheet'; title: string; text: string }[] = [
  { icon: 'sheet', title: 'Share a mark sheet', text: 'One that shows your marks for each exam question.' },
  { icon: 'tutor', title: 'Your examiner adds notes', text: 'What good answers did, and common slips.' },
  { icon: 'sparkle', title: 'Feedback for you', text: 'Where marks went, and a short plan to revise.' },
];

function EmptyFeedback() {
  const navigate = useNavigate();
  const { hasResults } = useResults();
  return (
    <section
      aria-labelledby="empty-feedback"
      className="grid justify-items-center gap-6 rounded-panel border border-dashed border-line-strong px-5 py-10 text-center sm:px-10"
    >
      <div className="grid justify-items-center gap-2">
        <h2 id="empty-feedback" className="text-xl font-semibold tracking-tight">
          No exam feedback yet
        </h2>
        <p className="max-w-md text-sm text-muted">
          {hasResults
            ? "Your marks are in. Feedback appears here once a mark sheet shows marks per question and the examiner has published notes for that exam."
            : 'Three small steps, and it appears here by itself.'}
        </p>
      </div>
      <ol className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        {HOW.map((step, i) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: EASE }}
            className="grid justify-items-center gap-2 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-line"
          >
            <span className="relative grid size-11 place-items-center rounded-full bg-mode-explain/10 text-mode-explain" aria-hidden="true">
              {step.icon === 'sheet' ? <MarkSheetIcon size={20} /> : <Icon name={step.icon} size={20} />}
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-surface text-[11px] font-semibold text-ink ring-1 ring-line">
                {i + 1}
              </span>
            </span>
            <p className="text-[14px] font-semibold">{step.title}</p>
            <p className="text-[13px] leading-snug text-muted">{step.text}</p>
          </motion.li>
        ))}
      </ol>
      <Button variant="primary" icon="arrow-right" onClick={() => navigate(paths.interview, { state: OPEN_RESULTS_STATE })}>
        {hasResults ? 'Upload a mark sheet with question marks' : 'Upload a mark sheet'}
      </Button>
    </section>
  );
}
