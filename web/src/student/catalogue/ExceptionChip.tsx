import type { ExceptionDecision } from '@modulematch/shared';
import { cx } from '../../components/cx.ts';
import { EXCEPTION_LABELS } from '../../components/exceptions.ts';
import { Icon } from '../../components/Icon.tsx';

/** The Senior Tutor's decision on a rule-exception request for this module (spec 11.1). */
export function ExceptionChip({ decision }: { decision: ExceptionDecision }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold',
        decision === 'approved' ? 'bg-fit-high/12 text-fit-high' : 'bg-ink/6 text-muted',
      )}
    >
      <Icon name={decision === 'approved' ? 'check' : 'x'} size={11} />
      {EXCEPTION_LABELS[decision]}
    </span>
  );
}
