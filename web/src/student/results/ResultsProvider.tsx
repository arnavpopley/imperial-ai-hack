// The student's own marks (spec 23): what is stored, the performance nudges and the tailored exam feedback,
// shared by the interview step, the catalogue, the module page, the feedback page and "Your data".
// Nudges are informational only: nothing here touches fit scores or rankings.
import type {
  ExamAwaitingMarks,
  PerformanceNudge,
  PerformanceView,
  ResultsUploadResponse,
  StudentResults,
  TailoredFeedback,
} from '@modulematch/shared';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../api.ts';
import { clearRevisionChecklists } from '../feedback/plan.ts';
import { useAsync, type AsyncResult } from '../hooks/useAsync.ts';
import { useReadySession } from '../state/SessionProvider.tsx';

export type UploadBody = Parameters<typeof api.uploadResults>[1];

interface ResultsValue {
  results: AsyncResult<StudentResults>;
  performance: AsyncResult<PerformanceView>;
  feedback: AsyncResult<TailoredFeedback[]>;
  /** Published exams with a mark but no matching question marks: feedback the student could unlock. */
  awaiting: AsyncResult<ExamAwaitingMarks[]>;
  /** True once the student has shared at least one mark. */
  hasResults: boolean;
  /** Codes that matched no catalogue module: kept, but not used for nudges. */
  unmatched: readonly string[];
  /** Whether the last upload was read by the model or the offline parser. */
  lastSource: ResultsUploadResponse['source'] | null;
  nudgeFor: (moduleId: string) => PerformanceNudge | undefined;
  upload: (body: UploadBody) => Promise<ResultsUploadResponse>;
  /** Withdraw consent and delete every stored mark. */
  withdraw: () => Promise<void>;
}

const ResultsContext = createContext<ResultsValue | null>(null);

const NO_PERFORMANCE: PerformanceView = { consent: false, overallAverage: null, topics: [], nudges: [] };

export function ResultsProvider({ children }: { children: ReactNode }) {
  const { session } = useReadySession();
  const sessionId = session.id;
  /**
   * Bumped after an upload or a withdrawal, so marks, nudges and feedback are read again. Changing it also
   * invalidates any read still in flight, so an older response can never replace a newer one.
   */
  const [version, setVersion] = useState(0);
  const [unmatched, setUnmatched] = useState<readonly string[]>([]);
  const [lastSource, setLastSource] = useState<ResultsUploadResponse['source'] | null>(null);

  const results = useAsync(() => api.results(sessionId), [sessionId, version]);
  // Nudges mention the student's interests, so they follow profile edits too.
  const performance = useAsync(() => api.performance(sessionId), [sessionId, version, session.profile.updatedAt]);
  const feedback = useAsync(() => api.examFeedback(sessionId), [sessionId, version]);
  const awaiting = useAsync(() => api.examAwaitingMarks(sessionId), [sessionId, version]);
  const { setData: setResults } = results;
  const { setData: setPerformance } = performance;
  const { setData: setFeedback } = feedback;
  const { setData: setAwaiting } = awaiting;

  const nudges = useMemo(() => {
    const view = performance.data;
    if (!view?.consent) return new Map<string, PerformanceNudge>();
    return new Map(view.nudges.map((n) => [n.moduleId, n]));
  }, [performance.data]);

  const nudgeFor = useCallback((moduleId: string) => nudges.get(moduleId), [nudges]);

  const upload = useCallback(
    async (body: UploadBody) => {
      const response = await api.uploadResults(sessionId, body);
      setResults(response.results);
      setUnmatched(response.unmatched);
      setLastSource(response.source);
      setVersion((v) => v + 1);
      return response;
    },
    [sessionId, setResults],
  );

  const withdraw = useCallback(async () => {
    setResults(await api.deleteResults(sessionId));
    // Nothing made from the deleted marks may linger, even if the follow-up reads fail.
    setPerformance(NO_PERFORMANCE);
    setFeedback([]);
    setAwaiting([]);
    clearRevisionChecklists(sessionId);
    setUnmatched([]);
    setLastSource(null);
    setVersion((v) => v + 1);
  }, [sessionId, setResults, setPerformance, setFeedback, setAwaiting]);

  const value = useMemo<ResultsValue>(
    () => ({
      results,
      performance,
      feedback,
      awaiting,
      hasResults: (results.data?.results.length ?? 0) > 0,
      unmatched: [...new Set([...unmatched, ...(results.data?.results ?? []).filter((r) => !r.matched).map((r) => r.code)])],
      lastSource,
      nudgeFor,
      upload,
      withdraw,
    }),
    [results, performance, feedback, awaiting, unmatched, lastSource, nudgeFor, upload, withdraw],
  );
  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}

export function useResults(): ResultsValue {
  const value = useContext(ResultsContext);
  if (!value) throw new Error('useResults must be used inside ResultsProvider');
  return value;
}

/** The nudge for one module, or undefined (also outside the provider, so cards render anywhere). */
export function useNudge(moduleId: string): PerformanceNudge | undefined {
  return useContext(ResultsContext)?.nudgeFor(moduleId);
}

/** Exams with tailored feedback, for the nav link; zero outside the provider or before it loads. */
export function useFeedbackCount(): number {
  return useContext(ResultsContext)?.feedback.data?.length ?? 0;
}

/** Exam feedback whose "This affects" list includes a module, for a link from that module's page. */
export function useFeedbackAffecting(moduleId: string): TailoredFeedback[] {
  const list = useContext(ResultsContext)?.feedback.data;
  return useMemo(() => (list ?? []).filter((f) => f.affectsModules.some((m) => m.moduleId === moduleId)), [list, moduleId]);
}
