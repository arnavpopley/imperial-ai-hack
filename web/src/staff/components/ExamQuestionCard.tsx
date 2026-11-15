// One exam question in the feedback editor: label, marks, topics, what good answers did, mistakes and pointers.
import { useId } from 'react';
import type { Ref } from 'react';
import { fieldId, questionId, questionTitle } from '../lib/examForm.ts';
import type { QuestionDraft } from '../lib/examForm.ts';
import { Field, ListEditor, TextArea, TextInput, TopicPicker } from './ExamFields.tsx';
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from './icons.tsx';
import { Button } from './ui.tsx';

export type MoveDirection = 'up' | 'down';

export interface QuestionCardProps {
  question: QuestionDraft;
  index: number;
  count: number;
  /** Inline error for the max marks field, shown after a save attempt. */
  marksError?: string;
  onChange: (next: QuestionDraft) => void;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
  /** The card's heading, so focus can follow a question after it moves. */
  headingRef?: Ref<HTMLHeadingElement>;
}

export function ExamQuestionCard({
  question: q,
  index,
  count,
  marksError,
  onChange,
  onMove,
  onRemove,
  headingRef,
}: QuestionCardProps) {
  const headingId = useId();
  const id = questionId(index);
  const title = questionTitle(q, index);
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...q, ...patch });

  return (
    <section
      aria-labelledby={headingId}
      className="@container rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg"
    >
      <header className="mb-6 flex flex-wrap items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl bg-brand-soft px-2 font-mono text-sm font-semibold text-brand"
        >
          {id}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} ref={headingRef} tabIndex={-1} className="text-base font-semibold break-words outline-none">
            <span className="sr-only">{id}: </span>
            {title}
          </h3>
          <p className="text-xs text-muted">Student marks for {id} attach here.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            className="size-10 px-0"
            aria-label={`Move ${id} up`}
            title="Move up"
            disabled={index === 0}
            onClick={() => onMove('up')}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            className="size-10 px-0"
            aria-label={`Move ${id} down`}
            title="Move down"
            disabled={index === count - 1}
            onClick={() => onMove('down')}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            variant="ghost"
            className="size-10 px-0 hover:text-fit-low"
            aria-label={`Delete ${id}`}
            title="Delete question"
            disabled={count === 1}
            onClick={onRemove}
          >
            <TrashIcon />
          </Button>
        </div>
      </header>

      <div className="grid gap-6">
        <div className="grid gap-4 @md:grid-cols-[minmax(0,1fr)_8.5rem]">
          <Field id={fieldId(q.key, 'label')} label="Question label" hint="What the question was about.">
            {(describedBy) => (
              <TextInput
                id={fieldId(q.key, 'label')}
                aria-describedby={describedBy}
                value={q.label}
                placeholder={`Question ${index + 1}`}
                onChange={(e) => set({ label: e.target.value })}
              />
            )}
          </Field>
          <Field id={fieldId(q.key, 'marks')} label="Max marks" error={marksError}>
            {(describedBy) => (
              <TextInput
                id={fieldId(q.key, 'marks')}
                aria-describedby={describedBy}
                invalid={Boolean(marksError)}
                type="number"
                inputMode="decimal"
                min={0.5}
                step={0.5}
                value={q.maxMarks}
                placeholder="20"
                onChange={(e) => set({ maxMarks: e.target.value })}
                className="tabular-nums"
              />
            )}
          </Field>
        </div>

        <TopicPicker
          id={fieldId(q.key, 'topics')}
          label="Topics"
          hint="Taxonomy topics the question tests. They link weak answers to later modules."
          selected={q.topics}
          onChange={(topics) => set({ topics })}
        />

        <Field id={fieldId(q.key, 'good')} label="What good answers did">
          {(describedBy) => (
            <TextArea
              id={fieldId(q.key, 'good')}
              aria-describedby={describedBy}
              rows={3}
              value={q.whatGoodAnswersDid}
              placeholder="For example: stated assumptions first, sketched the control volume, checked units."
              onChange={(e) => set({ whatGoodAnswersDid: e.target.value })}
            />
          )}
        </Field>

        <div className="grid gap-6 @2xl:grid-cols-2">
          <ListEditor
            id={fieldId(q.key, 'mistakes')}
            label="Common mistakes"
            hint="Enter adds another line."
            itemLabel={(n) => `Common mistake ${n} for ${id}`}
            addLabel="Add a mistake"
            placeholder="For example: sign error in the momentum balance"
            items={q.commonMistakes}
            onChange={(commonMistakes) => set({ commonMistakes })}
          />
          <ListEditor
            id={fieldId(q.key, 'pointers')}
            label="Revision pointers"
            hint="Lectures, sheets or past papers to revisit."
            itemLabel={(n) => `Revision pointer ${n} for ${id}`}
            addLabel="Add a pointer"
            placeholder="For example: problem sheet 4, questions 2 to 5"
            items={q.revisionPointers}
            onChange={(revisionPointers) => set({ revisionPointers })}
          />
        </div>
      </div>
    </section>
  );
}
