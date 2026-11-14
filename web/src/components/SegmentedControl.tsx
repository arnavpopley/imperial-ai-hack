// A single-choice group built on native radio inputs, so arrow keys move between options.
import { useId } from 'react';
import { cx } from './cx.ts';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  /** Hide the legend visually while keeping it for screen readers. */
  hideLegend?: boolean;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className={hideLegend ? 'sr-only' : 'mb-1.5 text-[13px] font-medium'}>{legend}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-xl bg-surface-2 p-0.5 ring-1 ring-line ring-inset">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              'relative cursor-pointer rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
              option.value === value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
