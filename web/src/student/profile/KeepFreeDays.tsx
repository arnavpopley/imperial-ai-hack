// Mon to Fri, each marked kept free, half kept free or available. Shared by Your data and the interview's
// "Here is what I heard" card (issue 144), so both read the same way.
import type { Weekday } from '@modulematch/shared';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { DAY_NAMES, WEEKDAYS } from '../labels.ts';

export function KeepFreeDays({
  avoidDays,
  avoidHalfDays = [],
  size = 'md',
}: {
  avoidDays: readonly Weekday[];
  avoidHalfDays?: readonly string[];
  size?: 'sm' | 'md';
}) {
  const avoid = new Set(avoidDays);
  const halvesOf = (d: Weekday) => avoidHalfDays.filter((h) => h.startsWith(d)).map((h) => (h.endsWith('-am') ? 'AM' : 'PM'));
  return (
    <ul className={cx('grid grid-cols-5', size === 'sm' ? 'gap-1.5' : 'gap-2')}>
      {WEEKDAYS.map((d) => {
        const free = avoid.has(d);
        const halves = free ? [] : halvesOf(d);
        return (
          <li
            key={d}
            className={cx(
              'grid place-items-center font-medium',
              size === 'sm' ? 'gap-0.5 rounded-xl py-1.5 text-[12px]' : 'gap-1 rounded-2xl py-3 text-sm',
              free ? 'bg-module-2 text-on-brand' : halves.length > 0 ? 'bg-module-2/20 text-module-2' : 'bg-surface-2 text-muted',
            )}
          >
            <span aria-hidden="true">{DAY_NAMES[d].slice(0, 3)}</span>
            <span className="sr-only">
              {DAY_NAMES[d]}:{' '}
              {free ? 'keep free' : halves.length > 0 ? `keep ${halves.map((h) => (h === 'AM' ? 'morning' : 'afternoon')).join(' and ')} free` : 'available'}
            </span>
            {halves.length > 0 ? (
              <span aria-hidden="true" className={cx('font-semibold', size === 'sm' ? 'text-[10px]' : 'text-[11px]')}>
                {halves.join(' ')}
              </span>
            ) : (
              <Icon name={free ? 'ban' : 'check'} size={size === 'sm' ? 12 : 14} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
