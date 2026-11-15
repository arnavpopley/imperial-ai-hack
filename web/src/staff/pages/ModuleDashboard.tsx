// Screen 8: demand against capacity, fit distribution and insight cards for one module.
import { MIN_COHORT } from '@modulematch/shared';
import type { Insight } from '@modulematch/shared';
import { DemandGauge } from '../components/DemandGauge.tsx';
import { FitHistogram } from '../components/FitHistogram.tsx';
import { InsightCard } from '../components/InsightCard.tsx';
import { PrivacyHidden } from '../components/PrivacyNote.tsx';
import { Panel } from '../components/ui.tsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews.tsx';
import { useInsights } from '../hooks/useInsights.ts';
import { plural } from '../lib/format.ts';
import { NO_INSIGHTS } from '../lib/insights.ts';
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

  // The server withholds a count of one to four students (null, spec 20.4): shown as a band, never a number or share.
  const { shortlisted } = summary;
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Shortlisted and capacity live in the demand panel, and the average fit on the histogram, so no stat row repeats them. */}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Demand against capacity" info="Students who shortlisted this module, against the places it has.">
          <DemandGauge shortlisted={shortlisted} capacity={summary.capacity} />
        </Panel>
        <Panel title="Fit distribution" info="How well the module fits each student in the cohort, in bands of 10 fit points.">
          <FitHistogram
            bands={summary.fitBands}
            averageFit={summary.averageFit}
            cohortSize={summary.cohortSize}
            strongFitShare={summary.strongFitShare}
          />
        </Panel>
      </div>

      <InsightsSection key={summary.moduleId} moduleId={summary.moduleId} />
    </div>
  );
}

function InsightsSection({ moduleId }: { moduleId: string }) {
  const { state, reload, decide, saving, failed } = useInsights(moduleId);

  const body = () => {
    if (state.status === 'loading') return <LoadingState label="Loading insights" />;
    if (state.status === 'error')
      return <ErrorState title="Could not load insights" message={state.error.message} onRetry={reload} />;

    // Defence in depth for spec 9.3: never render a card built on fewer than MIN_COHORT students.
    const shown: Insight[] = state.data.filter((i) => i.cohortSize >= MIN_COHORT);
    const hidden = state.data.length - shown.length;
    if (shown.length === 0)
      return hidden > 0 ? (
        <PrivacyHidden />
      ) : (
        <EmptyState icon="shield" title={NO_INSIGHTS.title}>
          {NO_INSIGHTS.body}
        </EmptyState>
      );

    return (
      <div className="grid gap-4">
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
      description="Nothing changes until you decide."
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
