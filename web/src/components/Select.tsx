// A native select drawn like the text inputs: same height, radius and border, with the shared chevron. Keeping the
// native element keeps keyboard, screen-reader and mobile pickers as the platform provides them.
import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

export function Select({
  className,
  wrapperClassName,
  ...rest
}: ComponentPropsWithRef<'select'> & { wrapperClassName?: string }) {
  return (
    <span className={cx('relative inline-flex min-w-0', wrapperClassName)}>
      <select
        className={cx(
          'h-10 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-line-strong bg-surface pr-9 pl-3 text-sm text-ink transition hover:border-muted focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/12 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...rest}
      />
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </span>
  );
}
