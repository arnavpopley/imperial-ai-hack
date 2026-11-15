// Spec 20.4 and 9.3: staff views are aggregate only, and nothing is shown for a cohort under five.
import { MIN_COHORT } from '@modulematch/shared';
import { ShieldIcon } from './icons.tsx';
import { EmptyState } from '../../components/StateViews.tsx';

export function PrivacyHidden() {
  return (
    <EmptyState icon="shield" title={`Cohort under ${MIN_COHORT}: hidden for privacy`}>
      Fewer than {MIN_COHORT} students sit behind this view, so it is withheld to keep individuals unidentifiable.
    </EmptyState>
  );
}

/** The privacy rule as one line, with the detail behind a disclosure so the header stays light. */
export function PrivacyNote() {
  return (
    <details className="group max-w-2xl text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 font-medium text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25 [&::-webkit-details-marker]:hidden">
        <ShieldIcon className="size-4" />
        Aggregate only, never one student
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="mt-3 rounded-2xl bg-white/10 p-4 leading-relaxed text-white/90 ring-1 ring-white/15 backdrop-blur">
        Module views show cohort totals, never a single student, and any figure drawn from fewer than {MIN_COHORT}{' '}
        students is hidden. Escalations are the exception: a student chose to send them, with a summary they approved.
      </p>
    </details>
  );
}
