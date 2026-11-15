import type { Recommendation } from '@modulematch/shared';
import { cx } from './cx.ts';
import { FACTOR_COLOURS } from './factorColours.ts';

type Sub = Recommendation['sub'];
type SubKey = keyof Sub;

export const SUB_SCORE_LABELS: Record<SubKey, string> = {
  interest: 'Interest',
  goal: 'Career goal',
  style: 'Learning style',
  breadth: 'Breadth',
};

const ORDER: readonly SubKey[] = ['interest', 'goal', 'style', 'breadth'];

interface SubScoreBarsProps {
  sub: Sub;
  /** stacked: labelled rows, for detail views. compact: four small columns, for cards. */
  variant?: 'stacked' | 'compact';
  dimmed?: boolean;
  className?: string;
}

/**
 * The four sub-scores behind a fit (spec 8.1 to 8.4), each in its factor colour, matching the weight sliders. A null
 * goal means no pathway is chosen yet.
 */
export function SubScoreBars({ sub, variant = 'stacked', dimmed = false, className }: SubScoreBarsProps) {
  return (
    <dl
      className={cx(
        variant === 'compact' ? 'grid grid-cols-4 gap-x-3' : 'grid gap-2.5',
        dimmed && 'grayscale',
        className,
      )}
    >
      {ORDER.map((key) => {
        const value = sub[key];
        const pct = value === null ? null : Math.round(value * 100);
        return (
          <div key={key} className={variant === 'compact' ? 'min-w-0' : 'grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3'}>
            <dt className={cx('text-muted', variant === 'compact' ? 'truncate text-2xs' : 'text-[13px]')}>
              {SUB_SCORE_LABELS[key]}
            </dt>
            <dd className={variant === 'compact' ? undefined : 'contents'}>
              <div
                // role=meter needs a value, so a sub-score that does not apply is an image that says so.
                {...(pct === null
                  ? { role: 'img', 'aria-label': `${SUB_SCORE_LABELS[key]}: not applicable, no pathway chosen` }
                  : {
                      role: 'meter',
                      'aria-label': SUB_SCORE_LABELS[key],
                      'aria-valuemin': 0,
                      'aria-valuemax': 100,
                      'aria-valuenow': pct,
                      'aria-valuetext': `${pct} out of 100`,
                    })}
                className={cx(
                  'relative h-1.5 overflow-hidden rounded-full bg-surface-2',
                  variant === 'compact' && 'mt-1',
                  pct === null && 'hatch text-line-strong',
                  dimmed && 'opacity-60',
                )}
              >
                {pct !== null && (
                  <div
                    className={cx('h-full rounded-full transition-[width] duration-500 ease-out-soft', FACTOR_COLOURS[key].fill)}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span
                aria-hidden="true"
                className={cx(
                  'tabular-nums',
                  variant === 'compact' ? 'mt-0.5 block text-2xs font-semibold' : 'text-right text-[13px] font-semibold',
                  pct === null && 'font-normal text-muted',
                )}
              >
                {pct === null ? 'n/a' : pct}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
