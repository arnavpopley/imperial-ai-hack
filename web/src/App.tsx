import { lazy } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { motion, MotionConfig } from 'motion/react';
import { cx } from './components/cx.ts';
import { Icon, type IconName } from './components/Icon.tsx';
import { Lazy } from './components/LazyRoute.tsx';
import { LogoMark, Wordmark } from './components/Logo.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { StudentApp } from './student/StudentApp.tsx';

// The staff console and the "How it works" page load on demand, so students only download the student app.
const StaffApp = lazy(() => import('./staff/StaffApp.tsx').then((m) => ({ default: m.StaffApp })));
const TraceApp = lazy(() => import('./trace/TraceApp.tsx').then((m) => ({ default: m.TraceApp })));

/** Set by scripts/build-vercel.ts for the public deployment, whose data is not persistent. */
const DEMO_INSTANCE = import.meta.env.VITE_DEMO_INSTANCE === '1';

type Role = 'student' | 'staff' | 'trace';

const ROLES: readonly { role: Role; to: string; label: string; icon: IconName }[] = [
  { role: 'student', to: '/', label: 'Student', icon: 'tutor' },
  { role: 'staff', to: '/staff', label: 'Staff', icon: 'user' },
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
        <main id="main" className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8">
          {/* Keyed by role so switching role fades the new console in; routes inside a role animate themselves. */}
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Lazy>
              <Routes>
                <Route path="/*" element={<StudentApp />} />
                <Route path="/staff/*" element={<StaffApp />} />
                <Route path="/trace/*" element={<TraceApp />} />
              </Routes>
            </Lazy>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}

function AppHeader({ role }: { role: Role }) {
  return (
    <header className="sticky top-0 z-(--z-header) border-b border-line/80 bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="ModuleMatch, home">
          <LogoMark size={36} />
          <Wordmark className="max-md:sr-only" />
        </Link>
        <nav aria-label="Explore" className="ml-auto flex items-center gap-1">
          {GUIDES.map((g) => {
            const active = g.role !== undefined && g.role === role;
            return (
              <Link
                key={g.to}
                to={g.to}
                aria-current={active ? 'page' : undefined}
                aria-label={g.label}
                className={cx(
                  'flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition-colors sm:px-3.5',
                  active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink',
                  g.phone ? '' : 'max-sm:hidden',
                )}
              >
                <Icon name={g.icon} size={16} />
                <span className="max-lg:sr-only">{g.label}</span>
              </Link>
            );
          })}
        </nav>
        <RoleSwitch role={role} />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Plain links beside the role switch. Phones keep only the icon for How it works. */
const GUIDES: readonly { to: string; label: string; icon: IconName; role?: Role; phone: boolean }[] = [
  { to: '/demo', label: 'Demo', icon: 'grid', phone: false },
  { to: '/trace', label: 'How it works', icon: 'sparkle', role: 'trace', phone: true },
];

/**
 * Student or staff, as one switch with a sliding thumb: blue for students, ink for staff, so the change of
 * view is obvious. No authentication this weekend (spec 5): the staff console sits behind this switch.
 */
function RoleSwitch({ role }: { role: Role }) {
  return (
    <nav aria-label="Role">
      <ul className="flex items-center rounded-full bg-surface-2 p-1 ring-1 ring-line">
        {ROLES.map((r) => {
          const active = r.role === role;
          return (
            <li key={r.role}>
              <Link
                to={r.to}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap transition-colors sm:px-4',
                  active ? (r.role === 'staff' ? 'text-canvas' : 'text-on-brand') : 'text-muted hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="role-thumb"
                    aria-hidden="true"
                    className={cx(
                      'pointer-events-none absolute inset-0 rounded-full shadow-soft',
                      r.role === 'staff' ? 'bg-ink' : 'bg-brand',
                    )}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon name={r.icon} size={16} className="max-sm:hidden" />
                  {r.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
