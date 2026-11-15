// Session restore (spec 13): a demo server instance that does not have a session can recreate it from the client's
// snapshot, but never overwrites one it has, never takes staff-side state or marks, and traces what it did.
import { RESTORE_BODY_MAX_BYTES, SESSION_VERSION_HEADER, schemas as S, type RestoreSessionBody, type SessionState } from '@modulematch/shared';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { inSessionQueue } from '../src/agents/supervisor.ts';
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
    updatedAt: s.updatedAt,
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

  it('never overwrites a copy as new as the snapshot or newer', async () => {
    const live = await newSession();
    const older = new Date(Date.parse(live.updatedAt) - 60_000).toISOString();
    for (const updatedAt of [live.updatedAt, older]) {
      const res = await post(`/api/sessions/${live.id}/restore`, snapshotOf(live, { shortlist: [repo.listModules()[0]!.id], mode: 'RECOMMEND', messages: [], updatedAt }));
      expect(res.status).toBe(200);
      const after = repo.getSession(live.id)!;
      expect(after.shortlist).toEqual(live.shortlist);
      expect(after.mode).toBe(live.mode);
      expect(after.messages).toHaveLength(live.messages.length);
    }
  });

  it('answers 409 "session stale" when its copy is older than the client\'s, then takes the newer copy', async () => {
    const live = await newSession();
    const newer = new Date(Date.parse(live.updatedAt) + 60_000).toISOString();
    // Every response says which version this instance holds.
    const plain = await app.request(`/api/sessions/${live.id}`);
    expect(plain.headers.get(SESSION_VERSION_HEADER)).toBe(live.updatedAt);
    expect((await app.request(`/api/sessions/${live.id}`, { headers: { [SESSION_VERSION_HEADER]: live.updatedAt } })).status).toBe(200);

    const stale = await app.request(`/api/sessions/${live.id}/recommendations`, { headers: { [SESSION_VERSION_HEADER]: newer } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'session stale' });

    // The client's newer copy (two modules shortlisted elsewhere) replaces this one, staff-side rows included.
    repo.createEscalation({ id: randomUUID(), sessionId: live.id, type: 'LOW_CONFIDENCE', summary: 'old copy', status: 'open', staffResponse: null, createdAt: live.createdAt, request: null, decision: null });
    const [a, b] = repo.listModules().map((m) => m.id);
    const res = await post(`/api/sessions/${live.id}/restore`, snapshotOf(live, { mode: 'PLAN', shortlist: [a!, b!], interview: { ...live.interview, confirmed: true, finished: true }, updatedAt: newer }));
    expect(res.status).toBe(200);
    const after = repo.getSession(live.id)!;
    expect(after).toMatchObject({ mode: 'PLAN', shortlist: [a, b], updatedAt: newer, escalations: [] });
    expect(repo.listTraceEvents(live.id).some((e) => e.output.includes('replacing an older copy'))).toBe(true);
    expect((await app.request(`/api/sessions/${live.id}/recommendations`, { headers: { [SESSION_VERSION_HEADER]: newer } })).status).toBe(200);
  });

  it('waits for a running turn on the session, then compares versions with what that turn saved', async () => {
    const live = await newSession();
    const order: string[] = [];
    const newer = new Date(Date.parse(live.updatedAt) + 60_000).toISOString();
    // A turn still running in the session's queue, which saves a change before it finishes.
    const turn = inSessionQueue(live.id, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      repo.updateSession(live.id, { weights: { ...live.weights, interest: 0.9 } });
      order.push('turn');
    });
    const restore = Promise.resolve(post(`/api/sessions/${live.id}/restore`, snapshotOf(live, { updatedAt: newer, messages: [] }))).then((res) => {
      order.push('restore');
      return res;
    });
    await turn;
    const res = await restore;
    expect(order).toEqual(['turn', 'restore']);
    // The snapshot is still the newer copy after the turn's save, so it replaced the session once the turn was done.
    expect(res.status).toBe(200);
    expect(repo.getSession(live.id)!).toMatchObject({ updatedAt: newer, weights: live.weights });
  });

  it('returns the stored session with a weights change, so the client copy keeps the new weights', async () => {
    const live = await newSession();
    const weights = { ...live.weights, interest: 0.8 };
    const res = await app.request(`/api/sessions/${live.id}/weights`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(weights) });
    const body = S.RecommendationsResponse.parse(await res.json());
    expect(body.session?.weights).toEqual(weights);
    expect(body.session?.updatedAt).toBe(res.headers.get(SESSION_VERSION_HEADER));
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
