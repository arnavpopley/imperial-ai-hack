// Session restore (spec 13): a demo server instance that does not have a session can recreate it from the client's
// snapshot, but never overwrites one it has, never takes staff-side state or marks, and traces what it did.
import { RESTORE_BODY_MAX_BYTES, schemas as S, type RestoreSessionBody, type SessionState } from '@modulematch/shared';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import * as repo from '../src/db/repo.ts';

const app = createApp();
const post = (path: string, b: unknown) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

beforeAll(() => {
  seedIfEmpty();
});

async function newSession(): Promise<SessionState> {
  const res = await post('/api/sessions', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 });
  return S.SessionState.parse(await res.json());
}

/** What the web client sends: its copy of the session, without staff-side state. */
function snapshotOf(s: SessionState, overrides: Partial<RestoreSessionBody> = {}): RestoreSessionBody {
  return {
    mode: s.mode,
    profile: s.profile,
    evidence: s.evidence,
    messages: s.messages,
    weights: s.weights,
    shortlist: s.shortlist,
    interview: s.interview,
    createdAt: s.createdAt,
    ...overrides,
  };
}

/** A session as another instance would have it, then gone from this one: the snapshot outlives the stored rows. */
async function lostSession(): Promise<{ id: string; snapshot: RestoreSessionBody }> {
  const original = await newSession();
  const [a, b] = repo.listModules().map((m) => m.id);
  const snapshot = snapshotOf(original, {
    mode: 'PLAN',
    shortlist: [a!, b!],
    interview: { ...original.interview, finished: true, confirmed: true },
    messages: [
      ...original.messages,
      { id: randomUUID(), sessionId: original.id, role: 'student', agent: null, content: 'I like robotics, and I was diagnosed with ADHD last year', at: original.createdAt },
    ],
  });
  // Recreate under a fresh id: the original rows stay where they are, as on the instance that made them.
  return { id: randomUUID(), snapshot: { ...snapshot, messages: snapshot.messages.map((m) => ({ ...m, id: randomUUID() })) } };
}

describe('POST /sessions/:id/restore', () => {
  it('creates a missing session from the snapshot, keeps its id, and traces the restore', async () => {
    const { id, snapshot } = await lostSession();
    expect((await app.request(`/api/sessions/${id}`)).status).toBe(404);

    const res = await post(`/api/sessions/${id}/restore`, snapshot);
    expect(res.status).toBe(201);
    const restored = S.SessionState.parse(await res.json());
    expect(restored).toMatchObject({ id, mode: 'PLAN', shortlist: snapshot.shortlist, escalations: [], escalationDraft: null, exceptions: [] });
    expect(restored.messages).toHaveLength(snapshot.messages.length);
    expect(restored.messages.every((m) => m.sessionId === id)).toBe(true);

    // The session now works on this instance like any other.
    expect((await app.request(`/api/sessions/${id}`)).status).toBe(200);
    expect((await app.request(`/api/sessions/${id}/recommendations`)).status).toBe(200);

    const trace = repo.listTraceEvents(id);
    expect(trace.some((e) => e.kind === 'mode' && e.output.startsWith('session restored on this instance in PLAN'))).toBe(true);
  });

  it('never overwrites a session this instance has', async () => {
    const live = await newSession();
    const res = await post(`/api/sessions/${live.id}/restore`, snapshotOf(live, { shortlist: [repo.listModules()[0]!.id], mode: 'RECOMMEND', messages: [] }));
    expect(res.status).toBe(200);
    const after = repo.getSession(live.id)!;
    expect(after.shortlist).toEqual(live.shortlist);
    expect(after.mode).toBe(live.mode);
    expect(after.messages).toHaveLength(live.messages.length);
  });

  it('applies the stored-text guardrails and the mode machine, and keeps only catalogue modules', async () => {
    const { id, snapshot } = await lostSession();
    const res = await post(`/api/sessions/${id}/restore`, { ...snapshot, mode: 'EXPLAIN', shortlist: [...snapshot.shortlist, 'NOT-A-MODULE'] });
    const restored = S.SessionState.parse(await res.json());
    expect(restored.shortlist).toEqual(snapshot.shortlist);
    // EXPLAIN is transient; with two modules shortlisted the session rests in PLAN.
    expect(restored.mode).toBe('PLAN');
    expect(restored.messages.at(-1)!.content).not.toContain('ADHD');
    const trace = repo.listTraceEvents(id);
    expect(trace.some((e) => e.kind === 'guardrail' && e.verdict === 'redact')).toBe(true);
    expect(trace.find((e) => e.output.startsWith('session restored'))!.output).toContain('NOT-A-MODULE');
  });

  it('refuses staff-side state, marks, unknown keys, ids it did not make, and oversized snapshots', async () => {
    const { id, snapshot } = await lostSession();
    for (const extra of [{ exceptions: [] }, { escalations: [] }, { results: [] }]) {
      expect((await post(`/api/sessions/${id}/restore`, { ...snapshot, ...extra })).status).toBe(400);
    }
    expect((await post('/api/sessions/not-a-uuid/restore', snapshot)).status).toBe(400);
    const huge = { ...snapshot, messages: snapshot.messages.map((m) => ({ ...m, content: 'x'.repeat(RESTORE_BODY_MAX_BYTES) })) };
    expect((await post(`/api/sessions/${id}/restore`, huge)).status).toBe(413);
    expect(repo.getSession(id)).toBeNull();
  });
});
