// "Your exam feedback" (spec 23): for each exam with a published examiner form and the student's own question
// marks, feedback tailored to those marks. Visible to the student only. An empty state explains how to get it.
import { motion, MotionConfig } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { errorStatus } from '../results/files.ts';
import { MarkSheetIcon } from '../results/icons.tsx';
import { useResults } from '../results/ResultsProvider.tsx';
import { OPEN_RESULTS_STATE, paths } from '../routes.ts';
import { useReadySession } from '../state/SessionProvider.tsx';
import { ExamFeedbackCard } from './ExamFeedbackCard.tsx';

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function FeedbackScreen() {
  const { session } = useReadySession();
  const { feedback, results } = useResults();
  const list = feedback.data ?? [];
  // A 404 means the route is not deployed yet: show the empty state rather than an error.
  const failed = feedback.error !== null && errorStatus(feedback.error) !== 404 && !feedback.data;
  const loading = feedback.loading && !feedback.data;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto grid max-w-5xl gap-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="relative overflow-hidden rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-mode-explain/12 blur-3xl"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-2xl gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-mode-explain">
                <Icon name="lock" size={15} /> Only you can see this
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your exam feedback</h1>
              <p className="text-base text-muted text-pretty">Feedback from your examiner's notes, tailored to your marks.</p>
            </div>
            <SampleDataLabel />
          </div>
        </motion.header>

        {loading && (
          <div className="grid gap-4" role="status" aria-label="Loading your feedback">
            <Skeleton className="h-48 w-full rounded-panel" />
            <Skeleton className="h-72 w-full rounded-panel" />
          </div>
        )}
        {failed && <ErrorState title="Your feedback did not load" message={feedback.error ?? ''} onRetry={feedback.reload} />}
        {!loading && !failed && list.length === 0 && <EmptyFeedback />}
        {list.map((item, index) => (
          <ExamFeedbackCard
            key={`${item.moduleId}-${item.examLabel}`}
            feedback={item}
            result={results.data?.results.find((r) => r.moduleId === item.moduleId)}
            sessionId={session.id}
            index={index}
          />
        ))}
      </div>
    </MotionConfig>
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
