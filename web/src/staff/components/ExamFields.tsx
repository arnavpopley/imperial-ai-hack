// Form controls for the exam feedback editor: labelled text fields, an editable list and a topic picker.
import { TOPIC_IDS } from '@modulematch/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { InputHTMLAttributes, KeyboardEvent, ReactNode, TextareaHTMLAttributes } from 'react';
import { focusRing, topicLabel } from '../lib/format.ts';
import { AlertIcon, ChevronDownIcon, PlusIcon, SearchIcon, XIcon } from './icons.tsx';
import { Button } from './ui.tsx';

export const inputClass = `w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted/80 aria-invalid:border-fit-low ${focusRing}`;

/** A label, optional hint and inline error wired to one control through aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="-mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {children(describedBy)}
      {error && (
        <p id={errorId} className="inline-flex items-center gap-1.5 text-xs font-medium text-fit-low">
          <AlertIcon className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  invalid,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={`${inputClass} ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} resize-y leading-relaxed ${className}`} {...props} />;
}

/**
 * An editable list of short lines. Enter adds a line below and moves to it; Backspace on an empty line
 * removes it and returns to the line above.
 */
export function ListEditor({
  id,
  label,
  hint,
  itemLabel,
  addLabel,
  placeholder,
  items,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Accessible name for one line, given its 1-based number. */
  itemLabel: (n: number) => string;
  addLabel: string;
  placeholder?: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const hintId = `${id}-hint`;

  useEffect(() => {
    if (focusIndex === null) return;
    // An empty list has no line to return to, so focus moves to its Add button.
    (items.length === 0 ? addRef.current : refs.current[Math.min(focusIndex, items.length - 1)])?.focus();
    setFocusIndex(null);
  }, [focusIndex, items.length]);

  const insertAt = (index: number) => {
    onChange([...items.slice(0, index), '', ...items.slice(index)]);
    setFocusIndex(index);
  };
  const removeAt = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setFocusIndex(Math.max(0, index - 1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      insertAt(index + 1);
    } else if (event.key === 'Backspace' && items[index] === '' && items.length > 1) {
      event.preventDefault();
      removeAt(index);
    }
  };

  return (
    <fieldset className="grid min-w-0 gap-2" aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-medium">{label}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      <ul className="grid gap-2">
        {/* Lines are plain strings with no identity of their own; the inputs are controlled, so index keys stay correct. */}
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-line-strong" />
            <input
              ref={(el) => {
                refs.current[index] = el;
              }}
              value={item}
              aria-label={itemLabel(index + 1)}
              placeholder={index === 0 ? placeholder : undefined}
              onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`${inputClass} py-2`}
            />
            <Button
              variant="ghost"
              className="size-10 shrink-0 px-0"
              aria-label={`Remove ${itemLabel(index + 1).toLowerCase()}`}
              onClick={() => removeAt(index)}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          ref={addRef}
          variant="ghost"
          className="-ml-2 text-brand hover:text-brand"
          onClick={() => insertAt(items.length)}
        >
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}

const TOPICS = TOPIC_IDS.map((id) => ({ id: id as string, label: topicLabel(id) })).sort((a, b) =>
  a.label.localeCompare(b.label),
);

/**
 * Taxonomy topics as removable chips plus a disclosure of filterable checkboxes. Checkboxes keep it fully
 * keyboard-operable without a custom listbox; Escape closes the list and returns focus to its button.
 */
export function TopicPicker({
  id,
  label,
  hint,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  selected: string[];
  onChange: (topics: string[]) => void;
}) {
  const listId = useId();
  const hintId = `${id}-hint`;
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = TOPICS.filter((t) => !needle || t.label.toLowerCase().includes(needle));

  const toggle = (topic: string) =>
    onChange(selected.includes(topic) ? selected.filter((t) => t !== topic) : [...selected, topic]);

  const close = () => {
    if (detailsRef.current) detailsRef.current.open = false;
    summaryRef.current?.focus();
  };

  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? hintId : undefined} className="grid min-w-0 gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      {hint && (
        <p id={hintId} className="-mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {selected.length === 0 && <span className="text-sm text-muted">No topics yet.</span>}
        {selected.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-3 text-[13px] font-medium text-brand"
          >
            {topicLabel(t)}
            <button
              type="button"
              onClick={() => toggle(t)}
              aria-label={`Remove topic ${topicLabel(t)}`}
              className={`grid size-6 place-items-center rounded-full hover:bg-brand/15 ${focusRing}`}
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <details
        ref={detailsRef}
        className="group relative"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && detailsRef.current?.open) {
            e.preventDefault();
            close();
          }
        }}
      >
        <summary
          ref={summaryRef}
          id={id}
          aria-controls={listId}
          className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3.5 text-sm font-medium text-muted hover:border-brand hover:text-ink [&::-webkit-details-marker]:hidden ${focusRing}`}
        >
          <PlusIcon />
          {selected.length === 0 ? 'Add topics' : 'Edit topics'}
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div
          id={listId}
          className="absolute z-(--z-popover) mt-2 w-full max-w-sm rounded-2xl border border-line bg-surface p-2 shadow-lift"
        >
          <label className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-brand">
            <SearchIcon className="size-4 text-muted" />
            <span className="sr-only">Filter topics</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter topics"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          <fieldset className="mt-2 max-h-64 overflow-y-auto">
            <legend className="sr-only">Taxonomy topics</legend>
            {matches.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted">No topics match “{query}”.</p>
            ) : (
              matches.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-2 has-focus-visible:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-brand"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="size-4 accent-brand"
                  />
                  {t.label}
                </label>
              ))
            )}
          </fieldset>
          <div className="mt-1 flex justify-end border-t border-line pt-2">
            <Button variant="ghost" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
