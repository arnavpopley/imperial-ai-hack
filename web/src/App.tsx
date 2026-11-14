import { lazy, Suspense } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { motion, MotionConfig } from 'motion/react';
import { cx } from './components/cx.ts';
import { Icon, type IconName } from './components/Icon.tsx';
import { LoadingState } from './components/StateViews.tsx';
import { StudentApp } from './student/StudentApp.tsx';

// The staff console and the "How it works" page load on demand, so students only download the student app.
const StaffApp = lazy(() => import('./staff/StaffApp.tsx').then((m) => ({ default: m.StaffApp })));
const TraceApp = lazy(() => import('./trace/TraceApp.tsx').then((m) => ({ default: m.TraceApp })));

/** Set by scripts/build-vercel.ts for the public deployment, whose data is not persistent. */
const DEMO_INSTANCE = import.meta.env.VITE_DEMO_INSTANCE === '1';

type Role = 'student' | 'staff' | 'trace';

const ROLES: readonly { role: Role; to: string; label: string; short: string; icon: IconName }[] = [
  { role: 'student', to: '/', label: 'Student', short: 'Student', icon: 'tutor' },
  { role: 'staff', to: '/staff', label: 'Staff', short: 'Staff', icon: 'user' },
  { role: 'trace', to: '/trace', label: 'How it works', short: 'How it works', icon: 'sparkle' },
];

function roleFor(pathname: string): Role {
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return 'staff';
  if (pathname === '/trace' || pathname.startsWith('/trace/')) return 'trace';
  return 'student';
}

export function App() {
  const { pathname } = useLocation();
  const role = roleFor(pathname);
  return (
    // "user" turns transform animations off for people who ask for reduced motion; opacity fades remain.
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-launcher) focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lift"
        >
          Skip to content
        </a>
        <AppHeader role={role} />
        {DEMO_INSTANCE && (
          <p className="border-b border-line bg-brand-soft px-4 py-2 text-center text-xs text-ink">
            Public demo: all students are synthetic, and data resets when the server sleeps.
          </p>
        )}
        <main id="main" className="mx-auto w-full max-w-7xl px-4 pt-8 pb-28 sm:px-6 lg:px-8">
          {/* Keyed by role so switching role fades the new console in; routes inside a role animate themselves. */}
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Suspense fallback={<LoadingState label="Loading" />}>
              <Routes>
                <Route path="/*" element={<StudentApp />} />
                <Route path="/staff/*" element={<StaffApp />} />
                <Route path="/trace/*" element={<TraceApp />} />
              </Routes>
            </Suspense>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}

function AppHeader({ role }: { role: Role }) {
  return (
    <header className="sticky top-0 z-(--z-header) border-b border-line/80 bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="ModuleMatch, home">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-mode-explain text-on-brand shadow-soft"
          >
            <Icon name="compass" size={20} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight max-[400px]:sr-only">ModuleMatch</span>
        </Link>
        {/* No authentication this weekend (spec 5): the staff console sits behind this role switch. */}
        <nav aria-label="Role" className="ml-auto">
          <ul className="flex items-center gap-0.5 rounded-full bg-surface-2 p-1 ring-1 ring-line">
            {ROLES.map((r) => {
              const active = r.role === role;
              return (
                <li key={r.role}>
                  <Link
                    to={r.to}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4',
                      active ? 'text-on-brand' : 'text-muted hover:text-ink',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="role-pill"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-brand shadow-soft"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <Icon name={r.icon} size={16} className="max-sm:hidden" />
                      {r.short}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
