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
