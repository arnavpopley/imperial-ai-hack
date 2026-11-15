// A searchable multi-select following the ARIA combobox pattern: type to filter, arrow keys to move,
// Enter to toggle, Escape to close, Backspace on an empty field to remove the last choice.
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Secondary text, for example a module code. */
  detail?: string;
}

interface MultiSelectProps {
  label: string;
  hint?: string;
  options: readonly MultiSelectOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({ label, hint, options, selected, onChange, placeholder, disabled }: MultiSelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const needle = query.trim().toLowerCase();
  const matches = options.filter(
    (o) => !needle || o.label.toLowerCase().includes(needle) || o.detail?.toLowerCase().includes(needle),
  );
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));
  const byValue = new Map(options.map((o) => [o.value, o]));

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    setQuery('');
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive(Math.min(activeIndex + 1, matches.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        break;
      case 'Enter': {
        const option = matches[activeIndex];
        if (open && option) {
          event.preventDefault();
          toggle(option.value);
        }
        break;
      }
      case 'Escape':
        setOpen(false);
        break;
      case 'Backspace':
        if (!query && selected.length > 0) onChange(selected.slice(0, -1));
        break;
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-[12px] text-muted">
          {hint}
        </p>
      )}
      <div
        className={cx(
          'mt-1.5 flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-2 py-1.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/12',
          disabled && 'opacity-60',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-soft py-0.5 pr-1 pl-2 text-[13px] font-medium text-brand"
          >
            {byValue.get(value)?.label ?? value}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggle(value);
              }}
              className="grid size-5 place-items-center rounded-md hover:bg-brand/15"
            >
              <Icon name="x" size={12} label={`Remove ${byValue.get(value)?.label ?? value}`} />
            </button>
          </span>
        ))}
        <div className="flex min-w-[8rem] flex-1 items-center gap-1.5">
          <Icon name="search" size={15} className="ml-1 text-muted" />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-describedby={hint ? hintId : undefined}
            aria-activedescendant={open && matches[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
            value={query}
            disabled={disabled}
            placeholder={selected.length === 0 ? placeholder : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </div>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        aria-label={label}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lift"
      >
        {matches.length === 0 ? (
          <li className="px-3 py-2.5 text-[13px] text-muted">No modules match “{query}”.</li>
        ) : (
          matches.map((option, index) => {
            const isSelected = selected.includes(option.value);
            return (
              <li
                key={option.value}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                // Keep focus in the input so the list stays open while choosing.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(option.value)}
                onMouseEnter={() => setActive(index)}
                className={cx(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
                  index === activeIndex && 'bg-surface-2',
                )}
              >
                <span
                  className={cx(
                    'grid size-4 shrink-0 place-items-center rounded border',
                    isSelected ? 'border-brand bg-brand text-on-brand' : 'border-line-strong',
                  )}
                >
                  {isSelected && <Icon name="check" size={11} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.detail && <span className="font-mono text-2xs text-muted">{option.detail}</span>}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
