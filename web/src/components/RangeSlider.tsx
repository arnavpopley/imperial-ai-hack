// A labelled 0-1 slider. The native range input stays in place (invisible) for keyboard,
// pointer and screen-reader support, and a styled track and thumb are drawn underneath it.
import { useId } from 'react';
import { cx } from './cx.ts';

interface RangeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Spoken and shown value, for example "45%" or "Very comfortable". */
  valueText: string;
  step?: number;
  lowLabel?: string;
  highLabel?: string;
  disabled?: boolean;
  /** Draws the slider muted, for example while a value has not been answered yet. */
  unset?: boolean;
  hint?: string;
  className?: string;
}

export function RangeSlider({
  label,
  value,
  onChange,
  valueText,
  step = 0.05,
  lowLabel,
  highLabel,
  disabled = false,
  unset = false,
  hint,
  className,
}: RangeSliderProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const fraction = Math.min(1, Math.max(0, value));
  return (
    <div className={cx('min-w-0', disabled && 'opacity-55', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        <span className={cx('text-[13px] tabular-nums', unset ? 'text-muted' : 'font-semibold')}>{valueText}</span>
      </div>
      <div className="relative mt-1.5 h-6">
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={step}
          value={fraction}
          disabled={disabled}
          aria-valuetext={valueText}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(Number(event.target.value))}
          className="peer absolute inset-0 z-10 m-0 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ring-inset">
          <div
            className={cx('h-full rounded-full transition-[width] duration-75', unset ? 'bg-line-strong' : 'bg-brand')}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <div
          className={cx(
            'pointer-events-none absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface shadow-soft transition-[left,box-shadow] duration-75',
            unset ? 'border-line-strong' : 'border-brand',
            'peer-hover:shadow-lift peer-focus-visible:ring-4 peer-focus-visible:ring-brand/30',
          )}
          style={{ left: `calc(9px + (100% - 18px) * ${fraction})` }}
        />
      </div>
      {(lowLabel || highLabel) && (
        <div className="mt-0.5 flex justify-between gap-3 text-2xs text-muted" aria-hidden="true">
          <span>{lowLabel}</span>
          <span className="text-right">{highLabel}</span>
        </div>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-2xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
