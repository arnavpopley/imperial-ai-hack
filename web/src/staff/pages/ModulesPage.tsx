// Screen 8 shell: module picker beside the selected module's dashboard, tag editor or exam feedback form.
import type { StaffModuleSummary } from '@modulematch/shared';
import { Navigate, NavLink, Outlet, useOutletContext, useParams } from 'react-router';
import { api } from '../../api.ts';
import { ModulePicker } from '../components/ModulePicker.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui.tsx';
import { InboxIcon } from '../components/icons.tsx';
import { useResource } from '../hooks/useResource.ts';
import { focusRing, plural } from '../lib/format.ts';
import { byCohortFigure, isCohortVisible } from '../lib/privacy.ts';

interface ModulesOutlet {
  summaries: StaffModuleSummary[];
}

interface ModuleOutlet {
  summary: StaffModuleSummary;
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

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-24">
        <ModulePicker modules={state.data} />
      </div>
      <div className="min-w-0">
        <Outlet context={{ summaries: state.data } satisfies ModulesOutlet} />
      </div>
    </div>
  );
}

/** `/staff` lands on the highest-fit module so the dashboard is never blank. */
export function FirstModuleRedirect() {
  const { summaries } = useOutletContext<ModulesOutlet>();
  const first = [...summaries].sort(byCohortFigure((m) => m.averageFit))[0];
  return first ? <Navigate to={`/staff/modules/${encodeURIComponent(first.moduleId)}`} replace /> : null;
}

const typeLabel: Record<StaffModuleSummary['type'], string> = {
  core: 'Core',
  elective: 'Elective',
  'i-explore': 'I-Explore',
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
