// Screen 8 shell: module picker beside the selected module's dashboard, tag editor or exam feedback form.
import type { StaffModuleSummary } from '@modulematch/shared';
import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { api } from '../../api.ts';
import { ModulePicker, firstModule } from '../components/ModulePicker.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui.tsx';
import { InboxIcon } from '../components/icons.tsx';
import { useResource } from '../hooks/useResource.ts';
import { focusRing, plural } from '../lib/format.ts';
import type { CohortOffer, StaffModuleRow } from '../lib/moduleList.ts';
import { isCohortVisible } from '../lib/privacy.ts';

interface ModulesOutlet {
  summaries: StaffModuleRow[];
}

interface ModuleOutlet {
  summary: StaffModuleRow;
  /** False when the cohort is below the privacy minimum (spec 20.4), so no aggregate may be shown. */
  cohortVisible: boolean;
}

export const useModuleOutlet = () => useOutletContext<ModuleOutlet>();

export function ModulesPage() {
  const { state, reload } = useResource('staff-modules', api.staff.modules);

  if (state.status === 'loading') return <LoadingState label="Loading modules" rows={4} />;
  if (state.status === 'error')
    return <ErrorState title="Could not load modules" error={state.error} onRetry={reload} />;
  if (state.data.length === 0)
    return (
      <EmptyState icon={<InboxIcon className="size-6" />} title="No modules yet">
        Seed the database to see demand and fit for each module.
      </EmptyState>
    );

  // The route may add each module's offer to the cohort beside the shared summary fields.
  const summaries: StaffModuleRow[] = state.data;
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-24">
        <ModulePicker modules={summaries} />
      </div>
      <div className="min-w-0">
        <Outlet context={{ summaries } satisfies ModulesOutlet} />
      </div>
    </div>
  );
}

/** `/staff` lands on the strongest-fit option the cohort can choose, so the dashboard is never blank. */
export function FirstModuleRedirect() {
  const { summaries } = useOutletContext<ModulesOutlet>();
  const navigate = useNavigate();
  const first = firstModule(summaries);
  const target = first ? `/staff/modules/${encodeURIComponent(first.moduleId)}` : null;
  useEffect(() => {
    // The router renders location changes in a transition, so this can still commit for /staff after the user
    // has clicked another tab. Redirect only while the browser is really on /staff, or it would undo that click.
    if (target && /^\/staff\/?$/.test(window.location.pathname)) navigate(target, { replace: true });
  }, [target, navigate]);
  return null;
}

const typeLabel: Record<StaffModuleSummary['type'], string> = {
  core: 'Core',
  elective: 'Elective',
  'i-explore': 'I-Explore',
};

const OFFER_CHIP: Record<CohortOffer, { label: string; className: string }> = {
  elective: { label: 'Option for this cohort', className: 'bg-fit-high/10 text-fit-high ring-fit-high/30' },
  'i-explore': { label: 'Option for this cohort', className: 'bg-fit-high/10 text-fit-high ring-fit-high/30' },
  core: { label: 'Compulsory for this cohort', className: 'bg-brand-soft text-brand ring-brand/30' },
  'not-offered': { label: 'Not offered to this cohort', className: 'bg-surface-2 text-muted ring-line-strong' },
};

const tab = ({ isActive }: { isActive: boolean }) =>
  `-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
    isActive ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
  } ${focusRing}`;

export function ModuleLayout() {
  const { moduleId = '' } = useParams();
  const { summaries } = useOutletContext<ModulesOutlet>();
  const summary = summaries.find((m) => m.moduleId === moduleId);

  if (!summary)
    return (
      <EmptyState icon={<InboxIcon className="size-6" />} title="Module not found">
        There is no module with the id “{moduleId}”. Pick one from the list.
      </EmptyState>
    );

  const base = `/staff/modules/${encodeURIComponent(summary.moduleId)}`;
  return (
    <div className="grid grid-cols-1 gap-8">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="font-mono">{summary.code}</span>
          <span aria-hidden="true">·</span>
          <span>{typeLabel[summary.type]}</span>
          <span aria-hidden="true">·</span>
          <span>Synthetic cohort of {plural(summary.cohortSize, 'student')}</span>
          {summary.offer && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${OFFER_CHIP[summary.offer].className}`}>
              {OFFER_CHIP[summary.offer].label}
            </span>
          )}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-balance">{summary.title}</h2>
        <nav aria-label={`${summary.title} views`} className="mt-2 flex gap-6 border-b border-line">
          <NavLink to={base} end className={tab}>
            Dashboard
          </NavLink>
          <NavLink to={`${base}/tags`} className={tab}>
            Derived tags
          </NavLink>
          <NavLink to={`${base}/exam`} className={tab}>
            Exam feedback
          </NavLink>
        </nav>
      </header>
      <Outlet context={{ summary, cohortVisible: isCohortVisible(summary) } satisfies ModuleOutlet} />
    </div>
  );
}
