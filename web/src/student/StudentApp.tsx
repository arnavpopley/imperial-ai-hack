// WS4: the student app (spec 14, screens 1 to 7) as nested routes.
//   /                    the landing page, or a redirect to the screen for the stored session's mode
//   /welcome             the landing page, always (with a resume button for a returning student)
//   /start               onboarding, or that same redirect
//   /interview           interview chat and live profile
//   /catalogue           ranked modules with what-if weights
//   /modules/:moduleId   explanation with evidence
//   /timetable           weekly grid, clashes and swaps
//   /pathways            pathways, progress and societies
//   /feedback            tailored exam feedback from the examiner's notes and the student's own marks (spec 23)
//   /your-data           what we hold, the quotes behind it, edit and delete (spec 20.3)
import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Button } from '../components/Button.tsx';
import { ErrorState, LoadingState } from '../components/StateViews.tsx';
import { Lazy, lazyNamed, whenIdle } from '../components/LazyRoute.tsx';
import { ChatProvider } from './chat/ChatProvider.tsx';
import { ResultsProvider } from './results/ResultsProvider.tsx';
import { paths, routeForMode } from './routes.ts';
import { LandingScreen } from './screens/LandingScreen.tsx';
import { CatalogueProvider } from './state/CatalogueProvider.tsx';
import { ReferenceDataProvider } from './state/ReferenceDataProvider.tsx';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { yourDataPath } from './yourdata/paths.ts';

// The landing page is the only screen in the first download. Every other screen, and the shell around the
// session screens (which carries the advisor chat and its avatars), loads when first opened.
const OnboardScreen = lazyNamed(() => import('./screens/OnboardScreen.tsx'), 'OnboardScreen');
const StudentShell = lazyNamed(() => import('./shell/StudentShell.tsx'), 'StudentShell');
const InterviewScreen = lazyNamed(() => import('./screens/InterviewScreen.tsx'), 'InterviewScreen');
const CatalogueScreen = lazyNamed(() => import('./screens/CatalogueScreen.tsx'), 'CatalogueScreen');
const ModuleDetailScreen = lazyNamed(() => import('./screens/ModuleDetailScreen.tsx'), 'ModuleDetailScreen');
const TimetableScreen = lazyNamed(() => import('./screens/TimetableScreen.tsx'), 'TimetableScreen');
const PathwaysScreen = lazyNamed(() => import('./screens/PathwaysScreen.tsx'), 'PathwaysScreen');
const FeedbackScreen = lazyNamed(() => import('./feedback/FeedbackScreen.tsx'), 'FeedbackScreen');
const YourDataPage = lazyNamed(() => import('./yourdata/YourDataPage.tsx'), 'YourDataPage');

export function StudentApp() {
  // After the first paint, warm the demo path (onboarding, the shell, the interview and the catalogue), so the
  // first clicks do not wait on a download. Rarely used screens still load only when opened.
  useEffect(
    () =>
      whenIdle(() => {
        for (const screen of [OnboardScreen, StudentShell, InterviewScreen, CatalogueScreen]) screen.preload();
      }),
    [],
  );
  return (
    <ReferenceDataProvider>
      <SessionProvider>
        <Routes>
          <Route index element={<EntryRoute page={<LandingScreen />} />} />
          <Route path={paths.welcome.slice(1)} element={<WelcomeRoute />} />
          <Route path={paths.start.slice(1)} element={<EntryRoute page={<Lazy><OnboardScreen /></Lazy>} />} />
          <Route element={<SessionGate />}>
            <Route path="interview" element={<Lazy><InterviewScreen /></Lazy>} />
            <Route path="catalogue" element={<Lazy><CatalogueScreen /></Lazy>} />
            <Route path="modules/:moduleId" element={<Lazy><ModuleDetailScreen /></Lazy>} />
            <Route path="timetable" element={<Lazy><TimetableScreen /></Lazy>} />
            <Route path="pathways" element={<Lazy><PathwaysScreen /></Lazy>} />
            <Route path={paths.feedback.slice(1)} element={<Lazy><FeedbackScreen /></Lazy>} />
            <Route path={yourDataPath.slice(1)} element={<Lazy><YourDataPage /></Lazy>} />
          </Route>
          <Route path="*" element={<Navigate to={paths.onboard} replace />} />
        </Routes>
      </SessionProvider>
    </ReferenceDataProvider>
  );
}

/** A page for a new student; a returning student resumes at the screen for their mode (spec 12). */
function EntryRoute({ page }: { page: ReactNode }) {
  const { status, session } = useSession();
  if (status === 'ready' && session) return <Navigate to={routeForMode(session.mode)} replace />;
  if (status === 'none') return page;
  return <SessionStatusView />;
}

/** The landing page for everyone; a returning student gets a button back to where they were. */
function WelcomeRoute() {
  const { status, session } = useSession();
  return <LandingScreen resumeTo={status === 'ready' && session ? routeForMode(session.mode) : undefined} />;
}

/** Screens that need a session. Without one the student goes back to onboarding. */
function SessionGate() {
  const { status, session } = useSession();
  if (status === 'none') return <Navigate to={paths.onboard} replace />;
  if (status !== 'ready' || !session) return <SessionStatusView />;
  return (
    <ChatProvider key={session.id}>
      <CatalogueProvider key={session.id}>
        <ResultsProvider key={session.id}>
          <Lazy>
            <StudentShell />
          </Lazy>
        </ResultsProvider>
      </CatalogueProvider>
    </ChatProvider>
  );
}

function SessionStatusView() {
  const { status, error, retry, forget } = useSession();
  if (status === 'error') {
    return (
      <ErrorState title="Could not resume your session" message={error ?? 'The session could not be loaded.'} onRetry={retry}>
        <Button size="sm" variant="ghost" onClick={forget}>
          Start a new session
        </Button>
      </ErrorState>
    );
  }
  return <LoadingState label="Picking up where you left off" />;
}
