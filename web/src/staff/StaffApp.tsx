// Staff console (WS5, spec 14 screens 8 to 11): module-lead dashboard, tag editor, timetabling and escalations.
import { Link, NavLink, Route, Routes, useLocation } from 'react-router';
import { LockIcon } from './components/icons.tsx';
import { PrivacyNote } from './components/PrivacyNote.tsx';
import { EmptyState } from './components/ui.tsx';
import { focusRing } from './lib/format.ts';
import { EscalationDetail } from './pages/EscalationDetail.tsx';
import { EscalationPlaceholder, EscalationsPage } from './pages/EscalationsPage.tsx';
import { ModuleDashboard } from './pages/ModuleDashboard.tsx';
import { FirstModuleRedirect, ModuleLayout, ModulesPage } from './pages/ModulesPage.tsx';
import { TagEditor } from './pages/TagEditor.tsx';
import { TimetablePage } from './pages/TimetablePage.tsx';
import { StaffDataProvider, useStaffData } from './StaffData.tsx';

export function StaffApp() {
  return (
    <StaffDataProvider>
      <div className="grid grid-cols-1 gap-6">
        <StaffHeader />
        <Routes>
          <Route element={<ModulesPage />}>
            <Route index element={<FirstModuleRedirect />} />
            <Route path="modules/:moduleId" element={<ModuleLayout />}>
              <Route index element={<ModuleDashboard />} />
              <Route path="tags" element={<TagEditor />} />
            </Route>
          </Route>
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="escalations" element={<EscalationsPage />}>
            <Route index element={<EscalationPlaceholder />} />
            <Route path=":escalationId" element={<EscalationDetail />} />
          </Route>
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">That staff page does not exist. Use the tabs above.</EmptyState>
            }
          />
        </Routes>
      </div>
    </StaffDataProvider>
  );
}

const tab = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'
  } ${focusRing}`;

function StaffHeader() {
  const { pathname } = useLocation();
  const { queue } = useStaffData();
  // "/staff" itself redirects into a module, so the Modules tab owns both.
  const onModules = pathname === '/staff' || pathname === '/staff/' || pathname.startsWith('/staff/modules');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold tracking-tight">Staff console</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            <LockIcon className="size-3.5" />
            No sign-in in this prototype
          </span>
        </div>
        <nav aria-label="Staff sections" className="flex gap-1 rounded-xl bg-line/50 p-1">
          <Link to="/staff" className={tab(onModules)} aria-current={onModules ? 'page' : undefined}>
            Modules
          </Link>
          <NavLink to="/staff/timetable" className={({ isActive }) => tab(isActive)}>
            Timetabling
          </NavLink>
          <NavLink to="/staff/escalations" className={({ isActive }) => tab(isActive)}>
            Escalations
            {queue.unresolvedCount > 0 && (
              <span className="min-w-5 rounded-full bg-fit-low px-1.5 text-center text-xs leading-5 font-semibold text-surface tabular-nums">
                {queue.unresolvedCount}
                <span className="sr-only"> unresolved</span>
              </span>
            )}
          </NavLink>
        </nav>
      </div>
      <PrivacyNote />
    </div>
  );
}
