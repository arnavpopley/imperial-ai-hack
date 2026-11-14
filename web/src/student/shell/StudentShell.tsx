// Persistent frame for every post-onboarding screen: mode chip, sub-navigation with the shortlist
// count, the escalation tray, the "Ask the advisor" drawer and the "Your data" panel.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { NavLink, Outlet, useMatch } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Drawer } from '../../components/Drawer.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { ModeChip } from '../../components/ModeChip.tsx';
import { ChatPanel } from '../chat/ChatPanel.tsx';
import { paths } from '../routes.ts';
import { useReadySession } from '../state/SessionProvider.tsx';
import { EscalationTray } from './EscalationTray.tsx';
import { YourDataDrawer } from './YourDataDrawer.tsx';

interface AdvisorContextValue {
  /** Open the advisor drawer, optionally with a message ready in the composer. */
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
];

export function StudentShell() {
  const { session } = useReadySession();
  const [advisor, setAdvisor] = useState({ open: false, prefill: '', opened: 0 });
  const [dataOpen, setDataOpen] = useState(false);
  const onInterview = useMatch(paths.interview) !== null;
  const onModule = useMatch('/modules/:moduleId') !== null;
  const shortlistCount = session.shortlist.length;

  const openAdvisor = useCallback(
    (prefill = '') => setAdvisor((current) => ({ open: true, prefill, opened: current.opened + 1 })),
    [],
  );
  const advisorValue = useMemo(() => ({ openAdvisor }), [openAdvisor]);

  return (
    <AdvisorContext.Provider value={advisorValue}>
      <div className="grid grid-cols-1 gap-5 sm:gap-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ModeChip variant={session.mode} />
          <nav
            aria-label="Student sections"
            className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:px-0"
          >
            <ul className="flex gap-1 border-b border-line md:border-0">
              {TABS.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={tab.to}
                    className={({ isActive }) => {
                      const active = isActive || (tab.to === paths.catalogue && onModule);
                      return cx(
                        'relative flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition md:h-9',
                        active ? 'text-ink md:bg-surface md:shadow-soft md:ring-1 md:ring-line' : 'text-muted hover:text-ink',
                        active &&
                          'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand md:after:hidden',
                      );
                    }}
                  >
                    <Icon name={tab.icon} size={15} />
                    {tab.label}
                    {tab.to === paths.timetable && shortlistCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-on-brand tabular-nums">
                        {shortlistCount}
                        <span className="sr-only"> shortlisted</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!onInterview && (
              <Button variant="primary" size="sm" icon="chat" onClick={() => openAdvisor()}>
                <span className="sm:hidden">Ask</span>
                <span className="max-sm:hidden">Ask the advisor</span>
              </Button>
            )}
            <Button size="sm" icon="user" onClick={() => setDataOpen(true)}>
              Your data
            </Button>
          </div>
        </div>

        <EscalationTray className="max-w-3xl" />

        <Outlet />
      </div>

      <Drawer
        open={advisor.open}
        onClose={() => setAdvisor((current) => ({ ...current, open: false }))}
        title="Ask the advisor"
        subtitle="Explains scores and checks the rules. It never changes a number."
        headerExtra={<ModeChip variant={session.mode} className="max-sm:hidden" />}
      >
        <ChatPanel key={advisor.opened} variant="advisor" prefill={advisor.prefill} className="h-full" />
      </Drawer>
      <YourDataDrawer open={dataOpen} onClose={() => setDataOpen(false)} />
    </AdvisorContext.Provider>
  );
}
