// Screen 8: demand against capacity, fit distribution and insight cards for one module.
import { MIN_COHORT } from '@modulematch/shared';
import type { Insight } from '@modulematch/shared';
import { DemandGauge } from '../components/DemandGauge.tsx';
import { FitHistogram } from '../components/FitHistogram.tsx';
import { InsightCard } from '../components/InsightCard.tsx';
import { PrivacyHidden } from '../components/PrivacyNote.tsx';
import { EmptyState, ErrorState, LoadingState, Panel, StatTile } from '../components/ui.tsx';
import { SparkIcon } from '../components/icons.tsx';
import { useInsights } from '../hooks/useInsights.ts';
import { CAPACITY_LABEL, capacityStatus, percent, plural } from '../lib/format.ts';
import { useModuleOutlet } from './ModulesPage.tsx';

export function ModuleDashboard() {
  const { summary, cohortVisible } = useModuleOutlet();

  // Every figure here is drawn from the cohort, so a cohort under MIN_COHORT shows none of them.
  if (!cohortVisible)
    return (
      <Panel title="Module overview">
        <PrivacyHidden />
      </Panel>
    );

  const status = capacityStatus(summary.shortlisted, summary.capacity);
  return (
    <div className="grid grid-cols-1 gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1">
        <StatTile
          label="Shortlisted"
          value={summary.shortlisted}
          hint={summary.capacity === null ? 'No capacity limit' : `of ${summary.capacity} places`}
        />
        <StatTile label="Average fit" value={Math.round(summary.averageFit)} hint="out of 100, across the cohort" />
        <StatTile
          label="Capacity used"
          value={summary.capacity === null ? '—' : percent(summary.shortlisted / summary.capacity)}
          hint={CAPACITY_LABEL[status]}
        />
      </dl>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Demand against capacity" description="Students who shortlisted this module.">
          <DemandGauge shortlisted={summary.shortlisted} capacity={summary.capacity} />
        </Panel>
        <Panel title="Fit distribution" description="How well the module fits each student in the cohort.">
          <FitHistogram buckets={summary.fitHistogram} averageFit={summary.averageFit} />
        </Panel>
      </div>

      <InsightsSection key={summary.moduleId} moduleId={summary.moduleId} />
    </div>
  );
}

function InsightsSection({ moduleId }: { moduleId: string }) {
  const { state, reload, decide, saving, failed } = useInsights(moduleId);

  const body = () => {
    if (state.status === 'loading') return <LoadingState label="Loading insights" rows={2} />;
    if (state.status === 'error')
      return <ErrorState title="Could not load insights" error={state.error} onRetry={reload} />;

    // Defence in depth for spec 9.3: never render a card built on fewer than MIN_COHORT students.
    const shown: Insight[] = state.data.filter((i) => i.cohortSize >= MIN_COHORT);
    const hidden = state.data.length - shown.length;
    if (shown.length === 0)
      return hidden > 0 ? (
        <PrivacyHidden />
      ) : (
        <EmptyState icon={<SparkIcon className="size-6" />} title="No insights for this module yet">
          The Insights agent writes cards after the cohort changes. Check back once more students have shortlisted.
        </EmptyState>
      );

    return (
      <div className="grid gap-3">
        {shown.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            saving={saving.has(insight.id)}
            error={failed.get(insight.id)}
            onDecide={(decision) => void decide(insight, decision)}
          />
        ))}
        {hidden > 0 && (
          <p className="text-xs text-muted">
            {plural(hidden, 'more card')} withheld: cohort under {MIN_COHORT}, hidden for privacy.
          </p>
        )}
      </div>
    );
  };

  const pending =
    state.status === 'ready'
      ? state.data.filter((i) => i.decision === 'pending' && i.cohortSize >= MIN_COHORT).length
      : 0;

  return (
    <Panel
      title="Insights"
      description="Written by the Insights agent from engine numbers. Nothing changes until you decide."
      actions={
        pending > 0 ? (
          <span className="rounded-full bg-fit-mid/15 px-2.5 py-1 text-xs font-medium">
            {plural(pending, 'card')} awaiting a decision
          </span>
        ) : undefined
      }
    >
      {body()}
    </Panel>
  );
}
