// A calm note that a capped module is near or over capacity in the synthetic cohort (issue #68). It sits beside
// the fit score and never changes it or the ranking. The server sends nothing for counts under five students.
// The words are the staff console's (issue #111), and over capacity reads stronger than near capacity.
import { CAPACITY_LABELS, type ModuleDemandSignal } from '@modulematch/shared';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';

const SOURCE = 'From the synthetic cohort’s shortlists';

/** Over capacity is the stronger tone: danger against near capacity's warning, as on the staff console. */
const TONE: Record<ModuleDemandSignal['status'], BadgeTone> = { over: 'danger', near: 'warning' };

/** "Over capacity: 63 shortlists for 48 places" or "Near capacity: 56 shortlists for 60 places". */
export function demandText(signal: ModuleDemandSignal): string {
  return `${CAPACITY_LABELS[signal.status]}: ${signal.shortlisted} shortlists for ${signal.capacity} places`;
}

export function DemandChip({ signal, className }: { signal: ModuleDemandSignal; className?: string }) {
  return (
    <Badge tone={TONE[signal.status]} icon="user" title={SOURCE} className={className}>
      <span className="tabular-nums">{demandText(signal)}</span>
      <span className="sr-only"> ({SOURCE.toLowerCase()})</span>
    </Badge>
  );
}

/** The module page's fuller note: the chip, where the number comes from, and what it means for the student. */
export function DemandNote({ signal }: { signal: ModuleDemandSignal }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
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
