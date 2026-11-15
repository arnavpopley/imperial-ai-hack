// Clash marker (spec 14.1): certain, likely or possible, told apart by shape and label as well as colour.
import type { ClashLabel } from '@modulematch/shared';
import { Badge } from '../../components/Badge.tsx';

// A neutral Badge whose mark carries the clash colour, so the label stays at full ink contrast.
const STYLE: Record<ClashLabel, { label: string; mark: string }> = {
  certain: { label: 'Certain clash', mark: 'text-clash-certain' },
  likely: { label: 'Likely clash', mark: 'text-clash-likely' },
  possible: { label: 'Possible clash', mark: 'text-clash-possible' },
};

function Mark({ label }: { label: ClashLabel }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={`size-3 ${STYLE[label].mark}`}>
      {label === 'certain' && <circle cx="6" cy="6" r="5" fill="currentColor" />}
      {label === 'likely' && <path d="M6 1l5 9.5H1z" fill="currentColor" />}
      {label === 'possible' && (
        <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" />
      )}
    </svg>
  );
}

export function ClashChip({ label }: { label: ClashLabel }) {
  return (
    <Badge size="md" icon={<Mark label={label} />}>
      {STYLE[label].label}
    </Badge>
  );
}
