import { lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes, useMatch } from 'react-router';
import { StudentApp } from './student/StudentApp.tsx';

// The staff console and the trace page load on demand, so students only download the student app.
const StaffApp = lazy(() => import('./staff/StaffApp.tsx').then((m) => ({ default: m.StaffApp })));
const TraceApp = lazy(() => import('./trace/TraceApp.tsx').then((m) => ({ default: m.TraceApp })));

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1 text-sm font-medium ${isActive ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`;

export function App() {
  // A NavLink to "/" only matches the root, so the student tab is active on every path outside the other roles.
  const onStaff = useMatch('/staff/*') !== null;
  const onTrace = useMatch('/trace/*') !== null;
  const onStudent = !onStaff && !onTrace;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
        <span className="font-semibold tracking-tight">ModuleMatch</span>
        {/* No authentication this weekend (spec 5): the staff console sits behind this role switch. */}
        <nav className="flex gap-1" aria-label="Role">
          <Link to="/" className={tab({ isActive: onStudent })} aria-current={onStudent ? 'page' : undefined}>
            Student
          </Link>
          <NavLink to="/staff" className={tab}>
            Staff
          </NavLink>
          <NavLink to="/trace" className={tab}>
            Trace and evals
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <Routes>
            <Route path="/*" element={<StudentApp />} />
            <Route path="/staff/*" element={<StaffApp />} />
            <Route path="/trace/*" element={<TraceApp />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
