// The catalogue's search box (issue 62). It filters the ranked list and never re-orders it.
import { useId, useRef } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';

interface CatalogueSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** The id of the list the search filters. */
  controls: string;
  className?: string;
}

export function CatalogueSearch({ value, onChange, controls, className }: CatalogueSearchProps) {
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div role="search" className={cx('relative', className)}>
      <label className="sr-only" htmlFor={`${hintId}-input`}>
        Search modules
      </label>
      <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        id={`${hintId}-input`}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
        placeholder="Search by title, code or topic"
        aria-controls={controls}
        aria-describedby={hintId}
        autoComplete="off"
        spellCheck={false}
        className="h-11 w-full rounded-xl border border-line bg-surface pr-10 pl-10 text-[15px] shadow-soft outline-none placeholder:text-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 [&::-webkit-search-cancel-button]:hidden"
      />
      <span id={hintId} className="sr-only">
        Filters the list below and keeps it in fit order. Small typos are forgiven.
      </span>
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={16} label="Clear search" />
        </button>
      )}
    </div>
  );
}
