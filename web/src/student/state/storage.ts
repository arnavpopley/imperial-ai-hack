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

const DEMO_KEY = 'modulematch.demoSessionId';

/** The id of the interactive demo's session (Rosa's), so the app can label it as the example. */
export function readDemoSessionId(): string | null {
  try {
    return window.localStorage.getItem(DEMO_KEY);
  } catch {
    return null;
  }
}

export function writeDemoSessionId(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(DEMO_KEY);
    else window.localStorage.setItem(DEMO_KEY, id);
  } catch {
    // Without storage the demo still works; only the example label is lost after a reload.
  }
}

const DISMISSED_DRAFT_KEY = 'modulematch.dismissedDraft';

/** The identity of the escalation draft the student dismissed in this session, so it stays dismissed on reload. */
export function readDismissedDraft(sessionId: string): string | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DISMISSED_DRAFT_KEY) ?? 'null') as { sessionId?: unknown; draft?: unknown } | null;
    return stored?.sessionId === sessionId && typeof stored.draft === 'string' ? stored.draft : null;
  } catch {
    return null;
  }
}

export function writeDismissedDraft(sessionId: string, draft: string | null): void {
  try {
    if (draft === null) window.localStorage.removeItem(DISMISSED_DRAFT_KEY);
    else window.localStorage.setItem(DISMISSED_DRAFT_KEY, JSON.stringify({ sessionId, draft }));
  } catch {
    // Without storage a dismissed draft only stays dismissed until the page reloads.
  }
}

const ESCALATION_TRAY_KEY = 'modulematch.escalationTray';

/** Which tutor replies the student has read (folded to a chip) or dismissed, for this session only. */
export interface EscalationTrayMemory {
  seen: string[];
  dismissed: string[];
}

export function readEscalationTray(sessionId: string): EscalationTrayMemory {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ESCALATION_TRAY_KEY) ?? 'null') as
      | ({ sessionId?: unknown } & Partial<EscalationTrayMemory>)
      | null;
    if (stored?.sessionId !== sessionId) return { seen: [], dismissed: [] };
    const ids = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
    return { seen: ids(stored.seen), dismissed: ids(stored.dismissed) };
  } catch {
    return { seen: [], dismissed: [] };
  }
}

export function writeEscalationTray(sessionId: string, memory: EscalationTrayMemory): void {
  try {
    window.localStorage.setItem(ESCALATION_TRAY_KEY, JSON.stringify({ sessionId, ...memory }));
  } catch {
    // Without storage, a folded or dismissed reply comes back after a reload; nothing else is lost.
  }
}
