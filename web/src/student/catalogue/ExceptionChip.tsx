import type { ExceptionDecision } from '@modulematch/shared';
import { Badge } from '../../components/Badge.tsx';
import { EXCEPTION_LABELS } from '../../components/exceptions.ts';

/** The Senior Tutor's decision on a rule-exception request for this module (spec 11.1). */
export function ExceptionChip({ decision }: { decision: ExceptionDecision }) {
  return (
    <Badge tone={decision === 'approved' ? 'success' : 'neutral'} icon={decision === 'approved' ? 'check' : 'x'}>
      {EXCEPTION_LABELS[decision]}
    </Badge>
  );
}
