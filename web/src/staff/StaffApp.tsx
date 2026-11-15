// Staff console (WS5, spec 14 screens 8 to 11, and spec 23): module-lead dashboard, tag editor, exam feedback,
// timetabling and escalations.
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { ClockAlertIcon, GridIcon, InboxIcon, LockIcon, MessageIcon } from './components/icons.tsx';
import { PrivacyNote } from './components/PrivacyNote.tsx';
import { EmptyState } from './components/ui.tsx';
import { focusRing } from './lib/format.ts';
import { Lazy, lazyNamed } from '../components/LazyRoute.tsx';
import { ModuleDashboard } from './pages/ModuleDashboard.tsx';
import { FirstModuleRedirect, ModuleLayout, ModulesPage } from './pages/ModulesPage.tsx';
import { StaffDataProvider, useStaffData } from './StaffData.tsx';

// The module dashboard is where the console opens; the other tabs, including the exam form editor, load when opened.
const TagEditor = lazyNamed(() => import('./pages/TagEditor.tsx'), 'TagEditor');
const ExamFeedbackPage = lazyNamed(() => import('./pages/ExamFeedbackPage.tsx'), 'ExamFeedbackPage');
const TimetablePage = lazyNamed(() => import('./pages/TimetablePage.tsx'), 'TimetablePage');
const EscalationsPage = lazyNamed(() => import('./pages/EscalationsPage.tsx'), 'EscalationsPage');
const EscalationPlaceholder = lazyNamed(() => import('./pages/EscalationsPage.tsx'), 'EscalationPlaceholder');
const EscalationDetail = lazyNamed(() => import('./pages/EscalationDetail.tsx'), 'EscalationDetail');
const FeedbackPage = lazyNamed(() => import('./pages/FeedbackPage.tsx'), 'FeedbackPage');

/** Fades each staff section in when the sub-navigation switches between them. */
function StaffSection({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={sectionFor(pathname)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className="min-w-0"
    >
      {children}
    </motion.div>
  );
}

export function StaffApp() {
  return (
    <StaffDataProvider>
      {/*
        The app header is sticky (4rem). Every control in the console keeps 6rem clear above it when the browser
        scrolls it into view, by focus or scrollIntoView, so nothing interactive lands under the header.
      */}
      <StaffLayout>
        <StaffHeader />
        <StaffSection>
        <Routes>
          <Route element={<ModulesPage />}>
            <Route index element={<FirstModuleRedirect />} />
            <Route path="modules/:moduleId" element={<ModuleLayout />}>
              <Route index element={<ModuleDashboard />} />
              <Route path="tags" element={<Lazy><TagEditor /></Lazy>} />
              <Route path="exam" element={<Lazy><ExamFeedbackPage /></Lazy>} />
            </Route>
          </Route>
          <Route path="timetable" element={<Lazy><TimetablePage /></Lazy>} />
          <Route path="escalations" element={<Lazy><EscalationsPage /></Lazy>}>
            <Route index element={<Lazy><EscalationPlaceholder /></Lazy>} />
            <Route path=":escalationId" element={<Lazy><EscalationDetail /></Lazy>} />
          </Route>
          <Route path="feedback" element={<Lazy><FeedbackPage /></Lazy>} />
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">That staff page does not exist. Use the tabs above.</EmptyState>
            }
          />
        </Routes>
        </StaffSection>
      </StaffLayout>
    </StaffDataProvider>
  );
}

/** The console's column. Escalations uses tighter gaps so the request and its decision fit the first screen. */
function StaffLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const gap = sectionFor(pathname) === 'escalations' ? 'gap-4' : 'gap-8';
  return <div className={`grid grid-cols-1 ${gap} [&_:is(a,button,input,select,textarea,summary,[tabindex])]:scroll-mt-24`}>{children}</div>;
}

const SECTIONS = [
  { key: 'modules', to: '/staff', label: 'Modules', Icon: GridIcon },
  { key: 'timetable', to: '/staff/timetable', label: 'Timetabling', Icon: ClockAlertIcon },
  { key: 'escalations', to: '/staff/escalations', label: 'Escalations', Icon: InboxIcon },
  { key: 'feedback', to: '/staff/feedback', label: 'Feedback', Icon: MessageIcon },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

function sectionFor(pathname: string): SectionKey {
  if (pathname.startsWith('/staff/timetable')) return 'timetable';
  if (pathname.startsWith('/staff/escalations')) return 'escalations';
  if (pathname.startsWith('/staff/feedback')) return 'feedback';
  // "/staff" itself redirects into a module, so the Modules tab owns both.
  return 'modules';
}

function StaffHeader() {
  const { pathname } = useLocation();
  const { queue } = useStaffData();
  const current = sectionFor(pathname);

  // On Escalations the request is the point of the page (demo step 6), so the hero shrinks to one line.
  const slim = current === 'escalations';

  return (
    <div className={slim ? 'grid gap-4' : 'grid gap-6'}>
      {slim ? (
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-slate-950 px-5 py-2 text-white shadow-soft">
          <h1 className="text-lg font-semibold tracking-tight">Staff console</h1>
          <PrivacyNote />
        </header>
      ) : (
      <header className="relative isolate overflow-hidden rounded-panel bg-slate-950 text-white shadow-lift">
        <img
          src="/images/staff-meeting.jpg"
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover opacity-55"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/10" />
        <div className="grid gap-4 px-6 py-8 sm:px-10 sm:py-10">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
            <LockIcon className="size-4" /> No sign-in in this prototype
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Staff console</h1>
          <p className="max-w-xl text-base text-white/85 text-pretty">
            See what students want, fix timetable clashes early, and answer the questions the AI hands to you.
          </p>
          <PrivacyNote />
        </div>
      </header>
      )}
      <nav aria-label="Staff sections" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <ul className="flex w-max gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
          {SECTIONS.map(({ key, to, label, Icon }) => {
            const active = key === current;
            return (
              <li key={key}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors sm:px-5 ${
                    active ? 'text-ink' : 'text-muted hover:text-ink'
                  } ${focusRing}`}
                >
                  {active && (
                    <motion.span
                      layoutId="staff-tab"
                      aria-hidden="true"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      className="pointer-events-none absolute inset-0 rounded-full bg-surface shadow-soft ring-1 ring-line"
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon className="size-4" />
                    {label}
                    {key === 'escalations' && queue.unresolvedCount > 0 && (
                      <span className="min-w-5 rounded-full bg-fit-low px-1.5 text-center text-xs leading-5 font-semibold text-surface tabular-nums">
                        {queue.unresolvedCount}
                        <span className="sr-only"> unresolved</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
