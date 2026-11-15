// A select-only combobox (WAI-ARIA APG pattern): a button that opens an animated listbox.
// Arrow keys, Home, End, Enter, Space, Escape and type-ahead behave like a native select; disabled
// options are shown but skipped.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/** Keys typed within this many milliseconds of each other build one type-ahead search. */
const TYPE_AHEAD_MS = 500;
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** A short second line, for example "Coming soon". */
  detail?: string;
  disabled?: boolean;
}

interface DropdownProps<T extends string> {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Dropdown<T extends string>({ label, options, value, onChange, className }: DropdownProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const typed = useRef({ text: '', at: 0 });

  /**
   * Native-select type-ahead: keys typed in quick succession search for a label prefix ("year 3"), and
   * pressing the same letter again cycles through the labels that start with it ("y", "y", "y").
   */
  const typeAhead = (char: string, from: number): number => {
    const now = Date.now();
    const text = (now - typed.current.at < TYPE_AHEAD_MS ? typed.current.text : '') + char.toLowerCase();
    typed.current = { text, at: now };
    const cycling = [...text].every((c) => c === text[0]);
    const search = cycling ? text.charAt(0) : text;
    const start = cycling ? from + 1 : from;
    for (let k = 0; k < options.length; k += 1) {
      const index = (start + k) % options.length;
      const option = options[index];
      if (option && !option.disabled && option.label.toLowerCase().startsWith(search)) return index;
    }
    return from;
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const openList = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  /** The next enabled option from `from` in `step` direction, or `from` if there is none. */
  const move = (from: number, step: 1 | -1): number => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) {
      if (!options[i]?.disabled) return i;
    }
    return from;
  };
  const first = () => move(-1, 1);
  const last = () => move(options.length, -1);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(key)) {
        event.preventDefault();
        openList();
        if (key === 'Home') setActive(first());
        if (key === 'End') setActive(last());
      } else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        const current = Math.max(
          0,
          options.findIndex((o) => o.value === value),
        );
        setOpen(true);
        setActive(typeAhead(key, current));
      }
      return;
    }
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((i) => move(i, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => move(i, -1));
        break;
      case 'Home':
        event.preventDefault();
        setActive(first());
        break;
      case 'End':
        event.preventDefault();
        setActive(last());
        break;
      case ' ':
        event.preventDefault();
        // Mid-search, a space is part of the label being typed ("year 3"), as in a native select.
        if (Date.now() - typed.current.at < TYPE_AHEAD_MS) setActive(typeAhead(key, active));
        else choose(active);
        break;
      case 'Enter':
        event.preventDefault();
        choose(active);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          setActive(typeAhead(key, active));
        }
    }
  };

  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const optionId = (index: number) => `${id}-option-${index}`;

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          'mt-2 flex h-13 w-full items-center justify-between gap-3 rounded-2xl border bg-surface px-4 text-left text-sm transition',
          open ? 'border-brand ring-4 ring-brand/12' : 'border-line-strong hover:border-brand/50',
        )}
      >
        <span className="truncate font-medium">{selected?.label ?? 'Choose'}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-x-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lift"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onPointerEnter={() => !option.disabled && setActive(index)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                  className={cx(
                    'flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm',
                    option.disabled ? 'cursor-not-allowed text-muted' : 'cursor-pointer',
                    index === active && !option.disabled && 'bg-surface-2',
                  )}
                >
                  <span className="grid">
                    <span className={cx(isSelected && 'font-semibold')}>{option.label}</span>
                    {option.detail && <span className="text-2xs text-muted">{option.detail}</span>}
                  </span>
                  {isSelected && <Icon name="check" size={15} className="shrink-0 text-brand" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
