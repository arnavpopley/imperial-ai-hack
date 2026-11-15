// A sample of the tailored feedback card a student would see, built in the browser from the draft form.
import type { Module } from '@modulematch/shared';
import { useId, useMemo, useState } from 'react';
import { previewFeedback, questionDisplayTitle, questionNumber } from '../lib/examForm.ts';
import type { ExamDraft } from '../lib/examForm.ts';
import { focusRing, topicLabel } from '../lib/format.ts';
import { inputClass } from './ExamFields.tsx';
import { CompassIcon, EyeIcon, TrendUpIcon } from './icons.tsx';
import { Select } from '../../components/Select.tsx';

export function FeedbackPreview({
  draft,
  moduleId,
  catalogue,
  moduleTitle,
}: {
  draft: ExamDraft;
  moduleId: string;
  catalogue: readonly Module[];
  moduleTitle: (id: string) => string;
}) {
  const selectId = useId();
  // Q2 by default, as in the brief; the examiner can pick any question.
  const [chosen, setChosen] = useState(1);
  const weakIndex = Math.min(chosen, draft.questions.length - 1);
  const preview = useMemo(
    () => previewFeedback({ draft, weakIndex, moduleId, catalogue }),
    [draft, weakIndex, moduleId, catalogue],
  );
  const weakAt = preview?.weakIndex ?? weakIndex;
  const weakId = questionNumber(draft.questions[weakAt]!, weakAt);

  return (
    <section aria-labelledby={`${selectId}-heading`} className="grid gap-4">
      <div className="grid gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          <EyeIcon className="size-4" /> Student preview
        </p>
        <h2 id={`${selectId}-heading`} className="text-heading text-balance">
          What a student who lost marks on {weakId} would see
        </h2>
        {draft.questions.length > 1 && (
          <div className="grid gap-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">
              Question the sample student lost marks on
            </label>
            <Select
              id={selectId}
              value={weakIndex}
              onChange={(e) => setChosen(Number(e.target.value))}
              wrapperClassName="w-full"
            >
              {draft.questions.map((q, i) => (
                <option key={q.key} value={i}>
                  {questionNumber(q, i)}: {questionDisplayTitle(q, i)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {preview ? (
        <article
          aria-label="Sample tailored feedback"
          className="overflow-hidden rounded-panel bg-surface shadow-lift ring-1 ring-line"
        >
          <header className="bg-brand px-5 py-4 text-on-brand">
            <p className="text-xs font-medium text-on-brand">Your exam feedback · {moduleTitle(moduleId)}</p>
            <p className="mt-0.5 text-base font-semibold">{preview.feedback.examLabel}</p>
          </header>
          <div className="grid gap-5 p-5">
            <p className="text-sm leading-relaxed">{preview.feedback.overall}</p>

            <ul aria-label="Sample marks by question" className="grid gap-1.5">
              {preview.marks.map((m) => (
                <li key={m.questionId} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
                  <span className={`font-mono font-semibold ${m.weak ? 'text-fit-low' : 'text-muted'}`}>{m.questionId}</span>
                  <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className={`block h-full rounded-full ${m.weak ? 'bg-fit-low' : 'bg-fit-high/70'}`}
                      style={{ width: `${(m.mark / m.maxMarks) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-muted">
                    {m.mark} / {m.maxMarks}
                  </span>
                </li>
              ))}
            </ul>

            {preview.feedback.weakPoints.map((w) => (
              <div key={w.questionId} className="grid gap-2 rounded-2xl bg-fit-low/6 p-4 ring-1 ring-fit-low/20">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold">
                  Where you lost marks: {w.questionId}
                  <span className="rounded-full bg-fit-low/12 px-2 py-0.5 text-xs font-semibold text-fit-low tabular-nums">
                    −{w.lostMarks} marks
                  </span>
                </p>
                {w.topics.length > 0 && (
                  <ul aria-label="Topics" className="flex flex-wrap gap-1.5">
                    {w.topics.map((t) => (
                      <li key={t} className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium ring-1 ring-line">
                        {topicLabel(t)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm leading-relaxed text-muted">{w.advice}</p>
              </div>
            ))}

            <div className="grid gap-2">
              <p className="text-sm font-semibold">Your revision plan</p>
              <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed marker:text-muted">
                {preview.feedback.revisionPlan.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            {preview.feedback.affectsModules.length > 0 && (
              <div className="grid gap-2">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <CompassIcon className="size-4 text-brand" /> Modules this affects
                </p>
                <ul className="grid gap-1.5 text-sm text-muted">
                  {preview.feedback.affectsModules.map((a) => (
                    <li key={a.moduleId}>{a.note}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.feedback.strengths.length > 0 && (
              <div className="grid gap-2">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <TrendUpIcon className="size-4 text-fit-high" /> What went well
                </p>
                <ul className="grid gap-1 text-sm text-muted">
                  {preview.feedback.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong p-5 text-sm text-muted">
          Add a maximum mark to at least one question to see the preview.
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted">
        A sample student with invented marks, built in your browser from the form as it stands. Nothing is sent, and no
        real student's marks are used. Real feedback is written from each student's own marks after you publish.
      </p>
      <a href="#exam-editor" className={`justify-self-start rounded text-xs font-medium text-brand hover:underline xl:hidden ${focusRing}`}>
        Back to the editor
      </a>
    </section>
  );
}
