// Owns the student's persisted session (spec 12): creation, resume from localStorage,
// local patches from the SSE stream, and polling while a member of staff owes a reply.
import type { EscalationDraft, SessionState } from '@modulematch/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, isSessionLost, SESSION_LOST_EVENT, setSessionCopy, type SessionLostDetail } from '../../api.ts';
import { draftIdentity } from '../../components/exceptions.ts';
import { errorMessage } from '../../components/StateViews.tsx';
import { sessionSnapshot } from './snapshot.ts';
import { readDismissedDraft, readStoredSessionId, writeDismissedDraft, writeStoredSessionId } from './storage.ts';

export type CreateSessionInput = Parameters<typeof api.createSession>[0];
/** lost: the server no longer knows the stored session (a demo server restarted); the student starts again. */
export type SessionStatus = 'loading' | 'none' | 'ready' | 'error' | 'lost';

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
        setStatus(isSessionLost(err) ? 'lost' : 'error');
      },
    );
    return () => {
      live = false;
    };
  }, [resumeId, attempt]);

  // Any request that finds the session gone (404 "session not found") ends the session in one place, so no screen
  // waits on data that will never come. Only the session this tab holds counts (loaded, or still resuming): a late
  // 404 from a session the student has left must not end the new one, and another tab's storage writes don't matter.
  const ownedId = useRef<string | null>(resumeId);
  const latest = useRef<SessionState | null>(null);
  useEffect(() => {
    ownedId.current = session?.id ?? resumeId;
    latest.current = session;
  }, [session, resumeId]);

  // When a demo server instance lacks the session or holds an older copy, the API client restores this copy there and
  // retries (spec 13), so the student never notices. Without a loaded copy (a reload) there is nothing to restore.
  useEffect(() => {
    const mine = (id: string) => (latest.current?.id === id ? latest.current : null);
    setSessionCopy({
      version: (id) => mine(id)?.updatedAt ?? null,
      snapshot: (id) => {
        const copy = mine(id);
        return copy ? sessionSnapshot(copy) : null;
      },
      // The newest version any instance reported becomes this copy's version, so older copies elsewhere get refreshed.
      seen: (id, version) => {
        const copy = mine(id);
        if (copy && version > copy.updatedAt) {
          latest.current = { ...copy, updatedAt: version };
          setSession((s) => (s && s.id === id && version > s.updatedAt ? { ...s, updatedAt: version } : s));
        }
      },
    });
    return () => setSessionCopy(null);
  }, []);
  useEffect(() => {
    const onLost = (event: Event) => {
      const { sessionId } = (event as CustomEvent<SessionLostDetail>).detail;
      if (sessionId === ownedId.current) setStatus('lost');
    };
    window.addEventListener(SESSION_LOST_EVENT, onLost);
    return () => window.removeEventListener(SESSION_LOST_EVENT, onLost);
  }, []);

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
    writeDismissedDraft('', null);
    setResumeId(null);
    setSession(null);
    setOfferedDraft(null);
    setDismissedDraft(null);
    setError(null);
    setStatus('none');
  }, []);

  const serverDraft = session?.escalationDraft ?? null;
  // A dismissal is remembered for the session, so the stored draft does not come back on every reload.
  const dismissed = dismissedDraft ?? (sessionId ? readDismissedDraft(sessionId) : null);
  const draft = offeredDraft ?? (serverDraft && draftIdentity(serverDraft) !== dismissed ? serverDraft : null);

  const dismissDraft = useCallback(() => {
    setOfferedDraft(null);
    if (!draft) return;
    setDismissedDraft(draftIdentity(draft));
    if (sessionId) writeDismissedDraft(sessionId, draftIdentity(draft));
  }, [draft, sessionId]);

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
