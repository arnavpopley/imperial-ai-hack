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
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Button } from '../components/Button.tsx';
import { ErrorState, LoadingState } from '../components/StateViews.tsx';
import { ChatProvider } from './chat/ChatProvider.tsx';
import { FeedbackScreen } from './feedback/FeedbackScreen.tsx';
import { ResultsProvider } from './results/ResultsProvider.tsx';
import { paths, routeForMode } from './routes.ts';
import { CatalogueScreen } from './screens/CatalogueScreen.tsx';
import { InterviewScreen } from './screens/InterviewScreen.tsx';
import { LandingScreen } from './screens/LandingScreen.tsx';
import { ModuleDetailScreen } from './screens/ModuleDetailScreen.tsx';
import { OnboardScreen } from './screens/OnboardScreen.tsx';
import { PathwaysScreen } from './screens/PathwaysScreen.tsx';
import { TimetableScreen } from './screens/TimetableScreen.tsx';
import { StudentShell } from './shell/StudentShell.tsx';
import { CatalogueProvider } from './state/CatalogueProvider.tsx';
import { ReferenceDataProvider } from './state/ReferenceDataProvider.tsx';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { yourDataPath } from './yourdata/paths.ts';
import { YourDataPage } from './yourdata/YourDataPage.tsx';

export function StudentApp() {
  return (
    <ReferenceDataProvider>
      <SessionProvider>
        <Routes>
          <Route index element={<EntryRoute page={<LandingScreen />} />} />
          <Route path={paths.welcome.slice(1)} element={<WelcomeRoute />} />
          <Route path={paths.start.slice(1)} element={<EntryRoute page={<OnboardScreen />} />} />
          <Route element={<SessionGate />}>
            <Route path="interview" element={<InterviewScreen />} />
            <Route path="catalogue" element={<CatalogueScreen />} />
            <Route path="modules/:moduleId" element={<ModuleDetailScreen />} />
            <Route path="timetable" element={<TimetableScreen />} />
            <Route path="pathways" element={<PathwaysScreen />} />
            <Route path={paths.feedback.slice(1)} element={<FeedbackScreen />} />
            <Route path={yourDataPath.slice(1)} element={<YourDataPage />} />
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
          <StudentShell />
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
