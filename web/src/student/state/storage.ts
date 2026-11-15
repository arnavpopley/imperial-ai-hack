// The session id survives reloads so a student resumes where they left off (spec 12).
// Storage can be unavailable (private windows, blocked site data), so every access is guarded.
const SESSION_KEY = 'modulematch.sessionId';

export function readStoredSessionId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSessionId(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    // Without storage the session still works; it just will not resume after a reload.
  }
}

const DISMISSED_DRAFT_KEY = 'modulematch.dismissedDraft';

/** The summary of the escalation draft the student dismissed in this session, so it stays dismissed on reload. */
export function readDismissedDraft(sessionId: string): string | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DISMISSED_DRAFT_KEY) ?? 'null') as { sessionId?: unknown; summary?: unknown } | null;
    return stored?.sessionId === sessionId && typeof stored.summary === 'string' ? stored.summary : null;
  } catch {
    return null;
  }
}

export function writeDismissedDraft(sessionId: string, summary: string | null): void {
  try {
    if (summary === null) window.localStorage.removeItem(DISMISSED_DRAFT_KEY);
    else window.localStorage.setItem(DISMISSED_DRAFT_KEY, JSON.stringify({ sessionId, summary }));
  } catch {
    // Without storage a dismissed draft only stays dismissed until the page reloads.
  }
}
