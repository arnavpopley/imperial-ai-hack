// The "Compare" checkbox on a module card (issue 62). Two or three modules at a time.
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { COMPARE_DOT, COMPARE_LETTERS, MAX_COMPARE } from './compare.ts';

interface CompareToggleProps {
  title: string;
  /** Position in the comparison (0, 1 or 2), or -1 when not selected. */
  slot: number;
  /** True when three other modules are already selected. */
  full: boolean;
  onToggle: () => void;
  className?: string;
}

export function CompareToggle({ title, slot, full, onToggle, className }: CompareToggleProps) {
  const checked = slot >= 0;
  const disabled = !checked && full;
  return (
    <label
      title={disabled ? `You can compare up to ${MAX_COMPARE} modules at a time` : undefined}
      className={cx(
        'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
        checked ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line text-muted hover:border-line-strong hover:text-ink',
        disabled && 'cursor-not-allowed opacity-50 hover:border-line hover:text-muted',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        aria-label={`Compare ${title}`}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'grid size-4 place-items-center rounded-[5px] text-[10px] font-bold text-on-brand',
          checked ? COMPARE_DOT[slot] : 'border-[1.5px] border-line-strong bg-surface',
        )}
      >
        {checked ? COMPARE_LETTERS[slot] : null}
      </span>
      Compare
      {disabled && <Icon name="lock" size={12} />}
    </label>
  );
}
