// Persistent frame for every post-onboarding screen: mode chip, sub-navigation with the shortlist count and
// the "Your data" link, the escalation tray, and the floating "Ask the advisor" launcher.
import { motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { ModeChip } from '../../components/ModeChip.tsx';
import { paths } from '../routes.ts';
import { useReadySession } from '../state/SessionProvider.tsx';
import { yourDataPath } from '../yourdata/paths.ts';
import { AdvisorLauncher, type AdvisorState } from './AdvisorLauncher.tsx';
import { EscalationTray } from './EscalationTray.tsx';

interface AdvisorContextValue {
  /** Open the advisor chat window, optionally with a message ready in the composer. */
  openAdvisor: (prefill?: string) => void;
}

const AdvisorContext = createContext<AdvisorContextValue | null>(null);

export function useAdvisor(): AdvisorContextValue {
  const value = useContext(AdvisorContext);
  if (!value) throw new Error('useAdvisor must be used inside StudentShell');
  return value;
}

const TABS: readonly { to: string; label: string; icon: IconName }[] = [
  { to: paths.interview, label: 'Interview', icon: 'chat' },
  { to: paths.catalogue, label: 'Catalogue', icon: 'grid' },
  { to: paths.timetable, label: 'Timetable', icon: 'calendar' },
  { to: paths.pathways, label: 'Pathways', icon: 'compass' },
  { to: yourDataPath, label: 'Your data', icon: 'lock' },
];

export function StudentShell() {
  const { session } = useReadySession();
  const { pathname } = useLocation();
  const [advisor, setAdvisor] = useState<AdvisorState>({ open: false, prefill: '', opened: 0 });
  const onInterview = useMatch(paths.interview) !== null;
  const onModule = useMatch('/modules/:moduleId') !== null;
  const shortlistCount = session.shortlist.length;

  const openAdvisor = useCallback(
    (prefill = '') => setAdvisor((current) => ({ open: true, prefill, opened: current.opened + 1 })),
    [],
  );
  const closeAdvisor = useCallback(() => setAdvisor((current) => ({ ...current, open: false })), []);
  const advisorValue = useMemo(() => ({ openAdvisor }), [openAdvisor]);

  return (
    <AdvisorContext.Provider value={advisorValue}>
      <div className="grid grid-cols-1 gap-6 sm:gap-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ModeChip variant={session.mode} />
          <nav
            aria-label="Student sections"
            className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:order-none lg:mx-0 lg:w-auto lg:px-0"
          >
            <ul className="flex gap-1 border-b border-line lg:rounded-full lg:border-0 lg:bg-surface-2 lg:p-1 lg:ring-1 lg:ring-line">
              {TABS.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={tab.to}
                    className={({ isActive }) => {
                      const active = isActive || (tab.to === paths.catalogue && onModule);
                      return cx(
                        'relative flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors lg:h-10',
                        active ? 'text-ink' : 'text-muted hover:text-ink',
                      );
                    }}
                  >
                    {({ isActive }) => {
                      const active = isActive || (tab.to === paths.catalogue && onModule);
                      return (
                        <>
                          {active && (
                            <motion.span
                              layoutId="student-tab"
                              aria-hidden="true"
                              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                              className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand lg:inset-0 lg:h-auto lg:bg-surface lg:shadow-soft lg:ring-1 lg:ring-line"
                            />
                          )}
                          <span className="relative flex items-center gap-2">
                            <Icon name={tab.icon} size={16} />
                            {tab.label}
                            {tab.to === paths.timetable && shortlistCount > 0 && (
                              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-on-brand tabular-nums">
                                {shortlistCount}
                                <span className="sr-only"> shortlisted</span>
                              </span>
                            )}
                          </span>
                        </>
                      );
                    }}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <EscalationTray className="max-w-3xl" />

        {/* Each screen fades and rises in; keyed by path so the animation replays on navigation. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          className="min-w-0"
        >
          <Outlet />
        </motion.div>
      </div>

      <AdvisorLauncher state={advisor} onOpen={() => openAdvisor()} onClose={closeAdvisor} showBubble={!onInterview} />
    </AdvisorContext.Provider>
  );
}
