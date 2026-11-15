// The client's copy of a session, as POST /sessions/:id/restore takes it (spec 13). Only what the student built goes
// in: escalations, approved exceptions and the escalation draft are staff-side, and marks are never part of it.
import { RESTORE_BODY_MAX_BYTES, RESTORE_EVIDENCE_MAX, RESTORE_MESSAGE_CHARS_MAX, RESTORE_MESSAGES_MAX, type RestoreSessionBody, type SessionState } from '@modulematch/shared';

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** The restore snapshot for a session: the latest messages and evidence, trimmed to fit the server's size limit. */
export function sessionSnapshot(session: SessionState): RestoreSessionBody {
  const snapshot: RestoreSessionBody = {
    mode: session.mode,
    profile: session.profile,
    evidence: session.evidence.slice(-RESTORE_EVIDENCE_MAX),
    messages: session.messages
      .slice(-RESTORE_MESSAGES_MAX)
      .map((m) => (m.content.length > RESTORE_MESSAGE_CHARS_MAX ? { ...m, content: m.content.slice(0, RESTORE_MESSAGE_CHARS_MAX) } : m)),
    weights: session.weights,
    shortlist: session.shortlist,
    interview: session.interview,
    createdAt: session.createdAt,
  };
  // Older messages go first; the profile, shortlist and evidence carry the student's choices.
  while (snapshot.messages.length > 0 && bytes(snapshot) > RESTORE_BODY_MAX_BYTES) snapshot.messages = snapshot.messages.slice(Math.ceil(snapshot.messages.length / 4));
  return snapshot;
}
