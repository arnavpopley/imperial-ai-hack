// Spec 23: the examiner's feedback form for a module's exam. Drafted by the AI from marking notes or filled in
// by hand, previewed as a student would see it, and shown to students only once an examiner publishes it.
import type { ExamFeedbackForm, Module } from '@modulematch/shared';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api.ts';
import { DraftProgress } from '../components/DraftProgress.tsx';
import { Field, TextArea, TextInput } from '../components/ExamFields.tsx';
import { ExamQuestionCard } from '../components/ExamQuestionCard.tsx';
import type { MoveDirection } from '../components/ExamQuestionCard.tsx';
import { CohortOnlyNote, ExamStatusChip, PublishDialog } from '../components/ExamStatus.tsx';
import { FeedbackPreview } from '../components/FeedbackPreview.tsx';
import { AlertIcon, CheckIcon, ExamIcon, PencilIcon, PlusIcon, SendIcon, SparkIcon, UndoIcon } from '../components/icons.tsx';
import { Button, ErrorState, LoadingState, Panel } from '../components/ui.tsx';
import { useResource } from '../hooks/useResource.ts';
import {
  EXAM_LABEL_FIELD,
  NOTES_LIMIT,
  blankDraft,
  blankQuestion,
  describeQuestions,
  draftFromForm,
  draftIssues,
  examStatus,
  exampleNotes,
  fieldId,
  moveItem,
  questionId,
  sameDraft,
  saveBody,
} from '../lib/examForm.ts';
import type { ExamDraft, ExamStatus, QuestionDraft } from '../lib/examForm.ts';
import { errorMessage } from '../lib/errors.ts';
import { focusRing, formatDateTime, plural } from '../lib/format.ts';
import { useStaffData } from '../StaffData.tsx';
import { useModuleOutlet } from './ModulesPage.tsx';

export function ExamFeedbackPage() {
  const { summary } = useModuleOutlet();
  // Keyed so switching modules starts from that module's own form.
  return <ExamWorkspace key={summary.moduleId} moduleId={summary.moduleId} />;
}

function ExamWorkspace({ moduleId }: { moduleId: string }) {
  const { state, reload } = useResource(`exam-form:${moduleId}`, () => api.staff.examForm(moduleId));

  if (state.status === 'loading')
    return (
      <ExamIntro>
        <LoadingState label="Loading the exam feedback form" rows={3} />
      </ExamIntro>
    );
  if (state.status === 'error')
    return (
      <ExamIntro>
        <ErrorState title="Could not load the exam feedback form" error={state.error} onRetry={reload} />
      </ExamIntro>
    );
  return <ExamFormWorkspace moduleId={moduleId} initial={state.data} />;
}

function ExamIntro({ status, children }: { status?: ExamStatus; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
              <ExamIcon className="size-5 text-brand" /> Exam feedback
            </h2>
            <p className="max-w-2xl text-sm text-muted text-pretty">
              Describe each question once for the whole cohort. Students who upload their question marks get feedback
              tailored to where they lost marks, and which later modules build on it.
            </p>
          </div>
          {status && <ExamStatusChip status={status} />}
        </div>
        <CohortOnlyNote />
      </div>
      {children}
    </div>
  );
}

/**
 * Unsaved drafts by module, kept for the browser session so switching tab or module does not lose a long form.
 * Cleared once the draft matches what the server holds.
 */
const unsavedDrafts = new Map<string, ExamDraft>();

type Busy = 'idle' | 'saving' | 'publishing';
type Notice = { tone: 'success' | 'error'; text: string } | null;

function ExamFormWorkspace({ moduleId, initial }: { moduleId: string; initial: ExamFeedbackForm | null }) {
  const { catalogue, moduleTitle } = useStaffData();
  const modules: Module[] = catalogue.status === 'ready' ? catalogue.data : [];
  const module = modules.find((m) => m.id === moduleId);

  const [saved, setSaved] = useState<ExamFeedbackForm | null>(initial);
  const [draft, setDraft] = useState<ExamDraft | null>(
    () => unsavedDrafts.get(moduleId) ?? (initial ? draftFromForm(initial) : null),
  );
  const [busy, setBusy] = useState<Busy>('idle');
  const [notice, setNotice] = useState<Notice>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [removed, setRemoved] = useState<{ question: QuestionDraft; index: number } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Where focus goes after the next render: a field id, or a question key whose heading should take focus.
  const [pendingFocus, setPendingFocus] = useState<{ field?: string; question?: string } | null>(null);
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const bannerRef = useRef<HTMLHeadingElement>(null);
  const [focusBanner, setFocusBanner] = useState(false);

  useEffect(() => {
    if (!pendingFocus) return;
    if (pendingFocus.field) document.getElementById(pendingFocus.field)?.focus();
    if (pendingFocus.question) headings.current.get(pendingFocus.question)?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  useEffect(() => {
    if (!focusBanner) return;
    bannerRef.current?.focus();
    setFocusBanner(false);
  }, [focusBanner]);

  const baseline = useMemo(() => (saved ? draftFromForm(saved) : null), [saved]);
  const status = examStatus(saved);
  const dirty = draft !== null && (baseline === null || !sameDraft(draft, baseline));
  const issues = useMemo(() => (draft ? draftIssues(draft) : []), [draft]);

  useEffect(() => {
    if (dirty && draft) unsavedDrafts.set(moduleId, draft);
    else unsavedDrafts.delete(moduleId);
  }, [dirty, draft, moduleId]);

  // A reload or closed tab would lose the in-memory copy too, so ask first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const issueFor = (field: string) => (showIssues ? issues.find((i) => i.field === field)?.message : undefined);

  if (!draft)
    return (
      <ExamIntro status={status}>
        <StartPanel
          module={module}
          onManual={(examLabel) => {
            const next = blankDraft(examLabel);
            setDraft(next);
            setPendingFocus({ field: fieldId(next.questions[0]!.key, 'label') });
          }}
          onDraft={async (body) => {
            const form = await api.staff.draftExamForm(moduleId, body);
            setSaved(form);
            setDraft(draftFromForm(form));
            setFocusBanner(true);
          }}
        />
      </ExamIntro>
    );

  const edit = (next: ExamDraft) => {
    setDraft(next);
    setNotice(null);
  };
  const editQuestion = (index: number, question: QuestionDraft) =>
    edit({ ...draft, questions: draft.questions.map((q, i) => (i === index ? question : q)) });

  const move = (index: number, direction: MoveDirection) => {
    const to = direction === 'up' ? index - 1 : index + 1;
    const question = draft.questions[index]!;
    edit({ ...draft, questions: moveItem(draft.questions, index, to) });
    setRemoved(null);
    setPendingFocus({ question: question.key });
    setAnnouncement(`${questionId(index)} moved ${direction}. It is now ${questionId(to)}.`);
  };

  const remove = (index: number) => {
    const question = draft.questions[index]!;
    const questions = draft.questions.filter((_, i) => i !== index);
    edit({ ...draft, questions });
    setRemoved({ question, index });
    const neighbour = questions[Math.min(index, questions.length - 1)];
    setPendingFocus(neighbour ? { question: neighbour.key } : null);
    setAnnouncement(`${questionId(index)} deleted. Undo is available in the action bar.`);
  };

  const undoRemove = () => {
    if (!removed) return;
    const questions = [...draft.questions];
    questions.splice(Math.min(removed.index, questions.length), 0, removed.question);
    edit({ ...draft, questions });
    setPendingFocus({ question: removed.question.key });
    setAnnouncement(`${questionId(removed.index)} restored.`);
    setRemoved(null);
  };

  const addQuestion = () => {
    const question = blankQuestion();
    edit({ ...draft, questions: [...draft.questions, question] });
    setPendingFocus({ field: fieldId(question.key, 'label') });
    setAnnouncement(`${questionId(draft.questions.length)} added.`);
  };

  /** Shows inline errors and focuses the first one; true when the draft is ready to send. */
  const validate = () => {
    if (issues.length === 0) return true;
    setShowIssues(true);
    setPendingFocus({ field: issues[0]!.field });
    return false;
  };

  const adopt = (form: ExamFeedbackForm) => {
    setSaved(form);
    setDraft(draftFromForm(form));
    setRemoved(null);
    setShowIssues(false);
  };

  const save = async () => {
    if (!validate()) return;
    setBusy('saving');
    try {
      adopt(await api.staff.saveExamForm(moduleId, saveBody(draft)));
      setNotice({ tone: 'success', text: 'Saved.' });
    } catch (e) {
      setNotice({ tone: 'error', text: `Could not save: ${errorMessage(e)}` });
    } finally {
      setBusy('idle');
    }
  };

  // Publishing always saves first, so students get exactly the form the examiner is looking at.
  const publish = async () => {
    setBusy('publishing');
    try {
      await api.staff.saveExamForm(moduleId, saveBody(draft));
      adopt(await api.staff.publishExamForm(moduleId));
      setPublishOpen(false);
      setNotice({ tone: 'success', text: 'Published.' });
    } catch (e) {
      setPublishOpen(false);
      setNotice({ tone: 'error', text: `Could not publish: ${errorMessage(e)}` });
    } finally {
      setBusy('idle');
    }
  };

  const discard = () => {
    setRemoved(null);
    setShowIssues(false);
    setNotice(null);
    setDraft(saved ? draftFromForm(saved) : null);
  };

  const locked = busy !== 'idle';
  const published = status === 'published';
  const shownIssues = showIssues ? issues.length : 0;

  return (
    <ExamIntro status={status}>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          id="exam-editor"
          aria-label="Exam feedback form"
          // Checked by draftIssues instead, so Save and Publish accept exactly the same values.
          noValidate
          className="grid min-w-0 grid-cols-1 gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {status === 'ai-draft' && (
            <div className="flex items-start gap-4 rounded-panel bg-mode-explain/8 p-5 ring-1 ring-mode-explain/30 sm:p-6">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mode-explain/12 text-mode-explain">
                <SparkIcon className="size-5" />
              </span>
              <div className="grid gap-1">
                <h3 ref={bannerRef} tabIndex={-1} className="text-base font-semibold outline-none">
                  AI draft: check before publishing
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  Drafted from your marking notes. Check every question, mark, topic and pointer against the paper.
                  Students see nothing until you publish.
                </p>
              </div>
            </div>
          )}
          {published && saved && (
            <div className="flex items-start gap-4 rounded-panel bg-fit-high/8 p-5 ring-1 ring-fit-high/25 sm:p-6">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-fit-high/12 text-fit-high">
                <CheckIcon className="size-5" />
              </span>
              <div className="grid gap-1">
                <h3 className="text-base font-semibold">Published to students</h3>
                <p className="text-sm leading-relaxed text-muted">
                  Students who uploaded question marks for {saved.examLabel} get feedback tailored from this form. Last
                  updated {formatDateTime(saved.updatedAt)}.
                </p>
              </div>
            </div>
          )}

          <fieldset disabled={locked} className="grid min-w-0 grid-cols-1 gap-6 transition-opacity disabled:opacity-60">
            <legend className="sr-only">Exam feedback form</legend>
            <Panel title="Exam details" description="Shown at the top of every student's feedback.">
              <div className="grid gap-5">
                <Field id={EXAM_LABEL_FIELD} label="Exam" error={issueFor(EXAM_LABEL_FIELD)}>
                  {(describedBy) => (
                    <TextInput
                      id={EXAM_LABEL_FIELD}
                      aria-describedby={describedBy}
                      invalid={Boolean(issueFor(EXAM_LABEL_FIELD))}
                      value={draft.examLabel}
                      placeholder="For example: Summer 2026 written exam"
                      onChange={(e) => edit({ ...draft, examLabel: e.target.value })}
                    />
                  )}
                </Field>
                <Field
                  id="exam-general-comments"
                  label="General comments"
                  hint="Cohort-wide observations, such as time management or presentation."
                >
                  {(describedBy) => (
                    <TextArea
                      id="exam-general-comments"
                      aria-describedby={describedBy}
                      rows={4}
                      value={draft.generalComments}
                      onChange={(e) => edit({ ...draft, generalComments: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            </Panel>

            <section aria-labelledby="exam-questions-heading" className="grid gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 id="exam-questions-heading" className="text-lg font-semibold tracking-tight">
                  Questions
                </h2>
                <p className="text-sm text-muted tabular-nums">
                  {describeQuestions(draft)}
                  <a href="#exam-preview" className={`ml-3 rounded font-medium text-brand hover:underline xl:hidden ${focusRing}`}>
                    See the preview
                  </a>
                </p>
              </div>
              {draft.questions.map((q, index) => (
                <ExamQuestionCard
                  key={q.key}
                  question={q}
                  index={index}
                  count={draft.questions.length}
                  marksError={issueFor(fieldId(q.key, 'marks'))}
                  onChange={(next) => editQuestion(index, next)}
                  onMove={(direction) => move(index, direction)}
                  onRemove={() => remove(index)}
                  headingRef={(el) => {
                    if (el) headings.current.set(q.key, el);
                    else headings.current.delete(q.key);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={addQuestion}
                className={`flex min-h-16 items-center justify-center gap-2 rounded-panel border-2 border-dashed border-line-strong text-sm font-semibold text-muted transition-colors hover:border-brand hover:bg-brand-soft/40 hover:text-brand ${focusRing}`}
              >
                <PlusIcon className="size-5" />
                Add question {questionId(draft.questions.length)}
              </button>
            </section>
          </fieldset>

          <div className="sticky bottom-3 z-(--z-sticky) flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur sm:px-5 sm:py-4">
            <div className="min-w-0 text-sm">
              <p className="sr-only" aria-live="polite">
                {announcement}
              </p>
              <StatusLine
                busy={busy}
                notice={notice}
                issues={shownIssues}
                dirty={dirty}
                removed={removed ? questionId(removed.index) : null}
                onUndo={undoRemove}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" disabled={!dirty || locked} onClick={discard}>
                Discard
              </Button>
              <Button type="submit" disabled={!dirty || locked}>
                {busy === 'saving' ? 'Saving…' : published ? 'Save changes' : 'Save draft'}
              </Button>
              <Button
                variant="primary"
                disabled={locked || (published && !dirty)}
                onClick={() => {
                  if (validate()) setPublishOpen(true);
                }}
              >
                <SendIcon />
                {published ? (
                  dirty ? 'Publish changes' : 'Published'
                ) : (
                  <>
                    Publish<span className="max-sm:sr-only"> to students</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        <aside
          id="exam-preview"
          aria-label="Student preview"
          className="min-w-0 scroll-mt-24 rounded-panel bg-surface-2/60 p-5 ring-1 ring-line xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto"
        >
          <FeedbackPreview draft={draft} moduleId={moduleId} catalogue={modules} moduleTitle={moduleTitle} />
        </aside>
      </div>

      <PublishDialog
        open={publishOpen}
        examLabel={draft.examLabel.trim() || 'this exam'}
        questionCount={draft.questions.length}
        aiDraft={status === 'ai-draft'}
        busy={busy === 'publishing'}
        onConfirm={() => void publish()}
        onClose={() => setPublishOpen(false)}
      />
    </ExamIntro>
  );
}

function StatusLine({
  busy,
  notice,
  issues,
  dirty,
  removed,
  onUndo,
}: {
  busy: Busy;
  notice: Notice;
  issues: number;
  dirty: boolean;
  removed: string | null;
  onUndo: () => void;
}) {
  if (busy !== 'idle') return <span className="text-muted">{busy === 'saving' ? 'Saving…' : 'Publishing…'}</span>;
  if (notice?.tone === 'error')
    return (
      <span role="alert" className="inline-flex items-center gap-1.5 text-fit-low">
        <AlertIcon /> {notice.text}
      </span>
    );
  if (issues > 0)
    return (
      <span role="alert" className="inline-flex items-center gap-1.5 text-fit-low">
        <AlertIcon /> Fix {plural(issues, 'field')} before saving.
      </span>
    );
  if (removed)
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-muted">Deleted {removed}.</span>
        <Button variant="ghost" className="min-h-8 px-2 text-brand hover:text-brand" onClick={onUndo}>
          <UndoIcon /> Undo
        </Button>
      </span>
    );
  if (notice?.tone === 'success')
    return (
      <span className="inline-flex items-center gap-1.5 text-fit-high">
        <CheckIcon /> {notice.text}
      </span>
    );
  return <span className="text-muted">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>;
}

/** Shown before a form exists: name the exam, then draft it from marking notes or fill it in by hand. */
function StartPanel({
  module,
  onManual,
  onDraft,
}: {
  module: Module | undefined;
  onManual: (examLabel: string) => void;
  onDraft: (body: { examLabel: string; notes: string }) => Promise<void>;
}) {
  const notesId = useId();
  const [examLabel, setExamLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [labelMissing, setLabelMissing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = examLabel.trim();

  const requireLabel = () => {
    if (label) return true;
    setLabelMissing(true);
    document.getElementById(EXAM_LABEL_FIELD)?.focus();
    return false;
  };

  const draft = async () => {
    if (!requireLabel()) return;
    setDrafting(true);
    setError(null);
    try {
      await onDraft({ examLabel: label, notes: notes.trim() });
    } catch (e) {
      setError(errorMessage(e));
      setDrafting(false);
    }
  };

  return (
    <Panel
      title="Create the feedback form"
      description="One form per exam, written for the whole cohort. Nothing reaches students until you publish."
    >
      <div className="@container grid gap-6">
        <div className="max-w-md">
          <Field
            id={EXAM_LABEL_FIELD}
            label="Exam"
            hint="As students know it."
            error={labelMissing && !label ? 'Give the exam a name first.' : undefined}
          >
            {(describedBy) => (
              <TextInput
                id={EXAM_LABEL_FIELD}
                aria-describedby={describedBy}
                invalid={labelMissing && !label}
                value={examLabel}
                disabled={drafting}
                placeholder="For example: Summer 2026 written exam"
                onChange={(e) => setExamLabel(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-5 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <form
            aria-labelledby={`${notesId}-title`}
            className="grid content-start gap-4 rounded-2xl bg-brand-soft/45 p-5 ring-2 ring-brand/25 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void draft();
            }}
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-brand shadow-soft">
                <SparkIcon className="size-5" />
              </span>
              <div className="grid gap-1">
                <h3 id={`${notesId}-title`} className="text-base font-semibold">
                  Draft from my marking notes
                </h3>
                <p className="text-sm text-muted">
                  Paste what you wrote while marking. The AI splits it into questions with topics, mistakes and
                  pointers, and you check the draft before anything is published.
                </p>
              </div>
            </div>
            <Field
              id={notesId}
              label="Marking notes"
              hint={
                <span className="tabular-nums">
                  {notes.length.toLocaleString('en-GB')} of {NOTES_LIMIT.toLocaleString('en-GB')} characters. Leave out
                  student names and candidate numbers.
                </span>
              }
            >
              {(describedBy) => (
                <TextArea
                  id={notesId}
                  aria-describedby={describedBy}
                  rows={11}
                  maxLength={NOTES_LIMIT}
                  value={notes}
                  disabled={drafting}
                  placeholder={'Q1 (20 marks), Bernoulli. Best answers stated assumptions first…\nCommon mistakes: …\nRevise: …'}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-surface font-mono text-[13px]"
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="inline-flex items-start gap-1.5 text-sm text-fit-low">
                <AlertIcon className="mt-1" /> Could not draft the form: {error}
              </p>
            )}
            {drafting ? (
              <DraftProgress />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" className="-ml-2" onClick={() => setNotes(exampleNotes(module))}>
                  Insert example notes (synthetic)
                </Button>
                <Button type="submit" variant="primary" disabled={!notes.trim()}>
                  <SparkIcon />
                  Draft the form
                </Button>
              </div>
            )}
          </form>

          <div className="grid content-start gap-4 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink">
                <PencilIcon className="size-5" />
              </span>
              <div className="grid gap-1">
                <h3 className="text-base font-semibold">Fill in manually</h3>
                <p className="text-sm text-muted">Start from a blank question and add one card per question on the paper.</p>
              </div>
            </div>
            <ul className="grid gap-2 text-sm text-muted">
              {['Label, maximum marks and topics', 'What good answers did', 'Common mistakes and revision pointers'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-fit-high" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <div>
              <Button
                disabled={drafting}
                onClick={() => {
                  if (requireLabel()) onManual(label);
                }}
              >
                <PlusIcon />
                Start with a blank question
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
