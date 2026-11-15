// Session restore (spec 13): on the public demo each server instance keeps its own SQLite, so a request can land on an
// instance that never saw the session. The client then sends its own copy of the session, and this module turns that
// snapshot into a stored session. The snapshot is untrusted input from the browser, so:
// - only student-built state is accepted (the zod contract refuses anything else, including marks);
// - staff-side state starts empty: no escalations, no draft, and no Senior Tutor exceptions a client could forge;
// - every stored text passes the G2 and G3 pattern rules again, as stored text does elsewhere;
// - the shortlist keeps only catalogue modules, and the mode is one the mode machine could rest in for that state.
import type { Mode, RestoreSessionBody, SessionState } from '@modulematch/shared';
import { schemas } from '@modulematch/shared';
import { redactByPattern } from '../guardrails/g2-redaction.ts';
import { stripInjection } from '../guardrails/g3-injection.ts';
import { restingModeFor } from './modes.ts';

/** Session ids are server-made UUIDs; a restore may only recreate one of those, never pick a new shape of id. */
export const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RestoredSession {
  state: SessionState;
  /** Texts the G2 or G3 pattern rules changed. */
  cleaned: number;
  /** Shortlisted ids that are not catalogue modules, dropped. */
  droppedModules: string[];
}

/** The pattern passes of G2 (redaction) then G3 (injection), with whether either changed the text. */
function clean(text: string): { text: string; changed: boolean } {
  const out = stripInjection(redactByPattern(text).text).text;
  return { text: out, changed: out !== text };
}

/**
 * The mode to restore in. Transient modes do not survive: EXPLAIN ends with its answer, and ESCALATED depends on an
 * escalation that stays on the instance that took it. Past the interview, the shortlist decides RECOMMEND or PLAN.
 */
export function restoredMode(mode: Mode, shortlist: readonly string[]): Mode {
  return mode === 'ONBOARD' || mode === 'INTERVIEW' ? mode : restingModeFor(shortlist);
}

export function restoredSession(id: string, input: RestoreSessionBody, moduleIds: ReadonlySet<string>, now = new Date().toISOString()): RestoredSession {
  const snapshot = schemas.RestoreSessionBody.parse(input);
  let cleaned = 0;
  const tidy = (text: string) => {
    const result = clean(text);
    if (result.changed) cleaned += 1;
    return result.text;
  };
  const shortlist = [...new Set(snapshot.shortlist)];
  const kept = shortlist.filter((m) => moduleIds.has(m));
  const state: SessionState = {
    id,
    mode: restoredMode(snapshot.mode, kept),
    profile: snapshot.profile,
    evidence: snapshot.evidence.map((e) => ({ ...e, sessionId: id, quote: tidy(e.quote) })),
    messages: snapshot.messages.map((m) => ({ ...m, sessionId: id, content: tidy(m.content) })),
    weights: snapshot.weights,
    shortlist: kept,
    interview: snapshot.interview,
    escalations: [],
    escalationDraft: null,
    exceptions: [],
    createdAt: snapshot.createdAt,
    updatedAt: now,
  };
  return { state, cleaned, droppedModules: shortlist.filter((m) => !moduleIds.has(m)) };
}
