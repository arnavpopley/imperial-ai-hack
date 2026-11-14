// Spec 20.4 and 9.3: staff views are aggregate only, and nothing is shown for a cohort under five.
import { MIN_COHORT } from '@modulematch/shared';
import { ShieldIcon } from './icons.tsx';
import { EmptyState } from './ui.tsx';

export function PrivacyHidden() {
  return (
    <EmptyState icon={<ShieldIcon className="size-6" />} title={`Cohort under ${MIN_COHORT}: hidden for privacy`}>
      Fewer than {MIN_COHORT} students sit behind this view, so it is withheld to keep individuals unidentifiable.
    </EmptyState>
  );
}

export function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted">
      <ShieldIcon className="mt-px size-4 text-fit-high" />
      <span>
        <span className="font-medium text-ink">Aggregate only.</span> Module views show cohort totals, never a single
        student, and any figure drawn from fewer than {MIN_COHORT} students is hidden. Escalations are the exception: a
        student chose to send them, with a summary they approved.
      </span>
    </p>
  );
}
