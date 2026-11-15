// A calm note that a capped module is near or over capacity in the synthetic cohort (issue #68). It sits beside
// the fit score and never changes it or the ranking. The server sends nothing for counts under five students.
import type { ModuleDemandSignal } from '@modulematch/shared';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';

const SOURCE = 'From the synthetic cohort’s shortlists';

/** "Popular: 63 shortlists for 48 places" or "Nearly full: 56 shortlists for 60 places". */
export function demandText(signal: ModuleDemandSignal): string {
  const lead = signal.status === 'over' ? 'Popular' : 'Nearly full';
  return `${lead}: ${signal.shortlisted} shortlists for ${signal.capacity} places`;
}

export function DemandChip({ signal, className }: { signal: ModuleDemandSignal; className?: string }) {
  return (
    <span
      title={SOURCE}
      className={cx(
        'inline-flex items-center gap-1 rounded-md bg-fit-mid/12 px-1.5 py-0.5 text-[11px] font-semibold text-ink tabular-nums',
        className,
      )}
    >
      <Icon name="user" size={11} />
      {demandText(signal)}
      <span className="sr-only"> ({SOURCE.toLowerCase()})</span>
    </span>
  );
}

/** The module page's fuller note: the chip, where the number comes from, and what it means for the student. */
export function DemandNote({ signal }: { signal: ModuleDemandSignal }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <DemandChip signal={signal} />
      <span>
        {SOURCE}.{' '}
        {signal.status === 'over'
          ? 'More students want it than there are places, so keep a backup in mind.'
          : 'Places may run out, so a backup is worth having.'}{' '}
        Your fit score is unchanged.
      </span>
    </p>
  );
}
