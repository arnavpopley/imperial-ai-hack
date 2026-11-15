// Status chip, privacy note and the publish confirmation for the exam feedback form (spec 23).
import { useEffect, useId, useRef, useState } from 'react';
import type { ExamStatus } from '../lib/examForm.ts';
import { CheckIcon, PencilIcon, SendIcon, ShieldIcon, SparkIcon } from './icons.tsx';
import { Button } from './ui.tsx';

const CHIP: Record<ExamStatus, { label: string; className: string; Icon: typeof CheckIcon }> = {
  unsaved: { label: 'Not saved yet', className: 'bg-surface-2 text-muted ring-line-strong', Icon: PencilIcon },
  draft: { label: 'Draft', className: 'bg-fit-mid/12 text-ink ring-fit-mid/40', Icon: PencilIcon },
  'ai-draft': { label: 'AI draft', className: 'bg-mode-explain/10 text-mode-explain ring-mode-explain/35', Icon: SparkIcon },
  published: { label: 'Published', className: 'bg-fit-high/10 text-fit-high ring-fit-high/35', Icon: CheckIcon },
};

export function ExamStatusChip({ status }: { status: ExamStatus }) {
  const { label, className, Icon } = CHIP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}>
      <Icon className="size-3.5" />
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}

/** Spec 23 privacy: the examiner writes for the whole cohort and never sees an individual's marks. */
export function CohortOnlyNote() {
  return (
    <p className="flex items-start gap-3 rounded-2xl bg-fit-high/8 px-4 py-3 text-sm ring-1 ring-fit-high/25">
      <ShieldIcon className="mt-0.5 size-5 text-fit-high" />
      <span>
        <strong className="font-semibold">Cohort-level feedback only.</strong> You never see individual students'
        marks here. Each student's marks stay with them, and their tailored feedback is built on their side.
      </span>
    </p>
  );
}

/**
 * Confirms publishing on the native modal dialog (focus trap, Escape, inert page). An AI draft also needs
 * the examiner to confirm they checked it, so a human signs off every form students see.
 */
export function PublishDialog({
  open,
  examLabel,
  questionCount,
  aiDraft,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  examLabel: string;
  questionCount: number;
  aiDraft: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setChecked(false);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-panel bg-surface p-0 text-ink shadow-lift backdrop:bg-scrim open:animate-rise"
    >
      {open && (
        <form
          method="dialog"
          className="grid gap-5 p-card sm:p-card-lg"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <SendIcon className="size-6" />
          </span>
          <div className="grid gap-2">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              Publish to students?
            </h2>
            <div id={bodyId} className="grid gap-2 text-sm leading-relaxed text-muted">
              <p>
                Students who uploaded their question marks for <strong className="text-ink">{examLabel}</strong> will
                get feedback tailored to the questions where they lost marks, built from these {questionCount}{' '}
                questions, your mistakes and pointers, and the modules that build on those topics.
              </p>
              <p>Students without question marks see nothing new. Publishing never shows you anyone's marks.</p>
            </div>
          </div>
          {aiDraft && (
            <label className="flex items-start gap-3 rounded-2xl bg-mode-explain/8 p-4 text-sm ring-1 ring-mode-explain/30">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 size-4 accent-brand"
                required
              />
              <span>
                <strong className="font-semibold">I have checked this AI draft</strong> question by question, and it
                matches the paper and my marking.
              </span>
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || (aiDraft && !checked)}>
              <SendIcon />
              {busy ? 'Publishing…' : 'Publish to students'}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
