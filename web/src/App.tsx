import { NavLink, Route, Routes } from 'react-router';
import { StaffApp } from './staff/StaffApp.tsx';
import { StudentApp } from './student/StudentApp.tsx';
import { TraceApp } from './trace/TraceApp.tsx';

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1 text-sm font-medium ${isActive ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`;

export function App() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
        <span className="font-semibold tracking-tight">ModuleMatch</span>
        {/* No authentication this weekend (spec 5): the staff console sits behind this role switch. */}
        <nav className="flex gap-1" aria-label="Role">
          <NavLink to="/" end className={tab}>
            Student
          </NavLink>
          <NavLink to="/staff" className={tab}>
            Staff
          </NavLink>
          <NavLink to="/trace" className={tab}>
            Trace and evals
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/*" element={<StudentApp />} />
          <Route path="/staff/*" element={<StaffApp />} />
          <Route path="/trace/*" element={<TraceApp />} />
        </Routes>
      </main>
    </div>
  );
}
