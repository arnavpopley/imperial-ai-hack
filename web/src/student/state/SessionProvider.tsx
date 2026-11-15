// Owns the student's persisted session (spec 12): creation, resume from localStorage,
// local patches from the SSE stream, and polling while a member of staff owes a reply.
import type { EscalationDraft, SessionState } from '@modulematch/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../api.ts';
import { draftIdentity } from '../../components/exceptions.ts';
import { errorMessage } from '../../components/StateViews.tsx';
import { readStoredSessionId, writeStoredSessionId } from './storage.ts';

export type CreateSessionInput = Parameters<typeof api.createSession>[0];
export type SessionStatus = 'loading' | 'none' | 'ready' | 'error';

/** Demo step 6: the staff reply appears live, so poll while an escalation is open or claimed. */
const STAFF_POLL_MS = 4000;

interface SessionContextValue {
  status: SessionStatus;
  session: SessionState | null;
  error: string | null;
  start: (body: CreateSessionInput) => Promise<SessionState>;
  /** Replace the whole session with a fresher copy from the server. */
  replace: (next: SessionState) => void;
  /** Patch the session locally, for example from an SSE profile_update. */
  update: (patch: (current: SessionState) => SessionState) => void;
  refresh: () => Promise<void>;
  retry: () => void;
  /** Drop the stored session and return to onboarding. */
  forget: () => void;
  /** An agent-drafted escalation waiting for the student's approval, from SSE or the stored session. */
  draft: EscalationDraft | null;
  offerDraft: (draft: EscalationDraft | null) => void;
  dismissDraft: () => void;
  /** Increments whenever ranked recommendations should be fetched again. */
  recsVersion: number;
  invalidateRecs: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [resumeId, setResumeId] = useState(readStoredSessionId);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<SessionStatus>(resumeId ? 'loading' : 'none');
  const [error, setError] = useState<string | null>(null);
  const [offeredDraft, setOfferedDraft] = useState<EscalationDraft | null>(null);
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null);
  const [recsVersion, setRecsVersion] = useState(0);

  // Resume a stored session on first load, and again on retry.
  useEffect(() => {
    if (!resumeId) return;
    let live = true;
    setStatus('loading');
    api.getSession(resumeId).then(
      (loaded) => {
        if (!live) return;
        setSession(loaded);
        setStatus('ready');
      },
      (err: unknown) => {
        if (!live) return;
        setError(errorMessage(err));
        setStatus('error');
      },
    );
    return () => {
      live = false;
    };
  }, [resumeId, attempt]);

  const sessionId = session?.id ?? null;
  const awaitingStaff = session?.escalations.some((e) => e.status !== 'resolved') ?? false;

  useEffect(() => {
    if (!sessionId || !awaitingStaff) return;
    let live = true;
    const timer = window.setInterval(() => {
      api.getSession(sessionId).then(
        (fresh) => {
          if (live) setSession(fresh);
        },
        () => {
          // A failed poll is transient: keep the last known state and try again on the next tick.
        },
      );
    }, STAFF_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [sessionId, awaitingStaff]);

  const start = useCallback(async (body: CreateSessionInput) => {
    const created = await api.createSession(body);
    writeStoredSessionId(created.id);
    setResumeId(null);
    setSession(created);
    setError(null);
    setStatus('ready');
    return created;
  }, []);

  const update = useCallback((patch: (current: SessionState) => SessionState) => {
    setSession((current) => (current ? patch(current) : current));
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setSession(await api.getSession(sessionId));
  }, [sessionId]);

  const forget = useCallback(() => {
    writeStoredSessionId(null);
    setResumeId(null);
    setSession(null);
    setOfferedDraft(null);
    setDismissedDraft(null);
    setError(null);
    setStatus('none');
  }, []);

  const serverDraft = session?.escalationDraft ?? null;
  const draft = offeredDraft ?? (serverDraft && draftIdentity(serverDraft) !== dismissedDraft ? serverDraft : null);

  const dismissDraft = useCallback(() => {
    setOfferedDraft(null);
    if (draft) setDismissedDraft(draftIdentity(draft));
  }, [draft]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      error,
      start,
      replace: setSession,
      update,
      refresh,
      retry: () => setAttempt((n) => n + 1),
      forget,
      draft,
      offerDraft: setOfferedDraft,
      dismissDraft,
      recsVersion,
      invalidateRecs: () => setRecsVersion((n) => n + 1),
    }),
    [status, session, error, start, update, refresh, forget, draft, dismissDraft, recsVersion],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** For screens behind the session guard, where a loaded session is guaranteed. */
export function useReadySession(): SessionContextValue & { session: SessionState } {
  const value = useSession();
  const { session } = value;
  if (!session) throw new Error('useReadySession must be used behind the session guard');
  return { ...value, session };
}
