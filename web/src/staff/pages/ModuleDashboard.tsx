// Screen 8: demand against capacity, fit distribution and insight cards for one module.
import { MIN_COHORT } from '@modulematch/shared';
import type { Insight } from '@modulematch/shared';
import { DemandGauge } from '../components/DemandGauge.tsx';
import { FitHistogram } from '../components/FitHistogram.tsx';
import { InsightCard } from '../components/InsightCard.tsx';
import { PrivacyHidden } from '../components/PrivacyNote.tsx';
import { EmptyState, ErrorState, LoadingState, Panel, StatTile } from '../components/ui.tsx';
import { GaugeIcon, ShieldIcon, TrendUpIcon, UsersIcon } from '../components/icons.tsx';
import { CountUp } from '../../components/CountUp.tsx';
import { useInsights } from '../hooks/useInsights.ts';
import { CAPACITY_LABEL, capacityStatus, plural } from '../lib/format.ts';
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
  const status = capacityStatus(shortlisted ?? 0, summary.capacity);
  return (
    <div className="grid grid-cols-1 gap-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Shortlisted"
          icon={<UsersIcon className="size-5" />}
          tone="bg-brand-soft text-brand"
          value={shortlisted === null ? `<${MIN_COHORT}` : <CountUp value={shortlisted} />}
          hint={summary.capacity === null ? 'No capacity limit' : `of ${summary.capacity} places`}
        />
        <StatTile
          label="Average fit"
          icon={<TrendUpIcon className="size-5" />}
          tone="bg-fit-high/10 text-fit-high"
          value={<CountUp value={Math.round(summary.averageFit)} />}
          hint="out of 100, across the cohort"
        />
        <StatTile
          label="Capacity used"
          icon={<GaugeIcon className="size-5" />}
          tone={status === 'over' ? 'bg-fit-low/10 text-fit-low' : status === 'near' ? 'bg-fit-mid/15 text-fit-mid' : 'bg-mode-plan/10 text-mode-plan'}
          value={
            summary.capacity === null || shortlisted === null ? (
              '—'
            ) : (
              <CountUp value={Math.round((shortlisted / summary.capacity) * 100)} suffix="%" />
            )
          }
          hint={shortlisted === null ? `Fewer than ${MIN_COHORT} students` : CAPACITY_LABEL[status]}
        />
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Demand against capacity" description="Students who shortlisted this module.">
          <DemandGauge shortlisted={shortlisted} capacity={summary.capacity} />
        </Panel>
        <Panel title="Fit distribution" description="How well the module fits each student in the cohort.">
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
        <EmptyState icon={<ShieldIcon className="size-6" />} title={NO_INSIGHTS.title}>
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
