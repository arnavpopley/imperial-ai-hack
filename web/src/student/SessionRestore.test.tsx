// @vitest-environment happy-dom
// On the public demo a request can land on a server instance that never saw the session. The client then restores the
// session there from its own copy and retries, so the student never notices; only a failed restore ends the session.
import { MotionGlobalConfig } from 'motion/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api.ts';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { writeStoredSessionId } from './state/storage.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const ID = 'restore-1';
const session = {
  id: ID,
  mode: 'PLAN',
  profile: { studentId: 'student-1', programme: 'MEng Mechanical Engineering', yearOfStudy: 3 },
  evidence: [],
  messages: [{ id: 'm1', sessionId: ID, role: 'assistant', agent: 'interviewer', content: 'Hi!', at: '2026-11-15T09:00:00.000Z' }],
  weights: { interest: 0.5 },
  shortlist: ['MECH60009', 'MECH60018'],
  interview: { depth: 'quick', confirmed: true },
  escalations: [{ id: 'e1', status: 'open' }],
  escalationDraft: null,
  exceptions: [{ moduleId: 'MECH60009', waived: ['prerequisite'] }],
  createdAt: '2026-11-15T09:00:00.000Z',
  updatedAt: '2026-11-15T09:05:00.000Z',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const notFound = () => json({ error: 'session not found' }, 404);

interface Call {
  method: string;
  path: string;
  body?: string;
}

/** Routes requests to `answer`, records each call, and serves the session itself on GET /sessions/:id. */
function mockFetch(answer: (call: Call, calls: Call[]) => Response) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = { method: init?.method ?? 'GET', path: String(input), body: init?.body as string | undefined };
    calls.push(call);
    if (call.method === 'GET' && call.path === `/api/sessions/${ID}`) return json(session);
    return answer(call, calls);
  });
  return calls;
}

async function mountReady() {
  writeStoredSessionId(ID);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  function Status() {
    return <p data-testid="status">{useSession().status}</p>;
  }
  await act(async () =>
    root.render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const status = () => container.querySelector('[data-testid="status"]')?.textContent;
  expect(status()).toBe('ready');
  return { status, done: () => act(() => root.unmount()) };
}

afterEach(() => {
  vi.restoreAllMocks();
  writeStoredSessionId(null);
  document.body.innerHTML = '';
});

describe('restoring a session on an instance that does not have it', () => {
  it('restores from the client copy and retries, so the request succeeds as if nothing happened', async () => {
    let restored = false;
    const calls = mockFetch((call) => {
      if (call.path.endsWith('/restore')) {
        restored = true;
        return json(session, 201);
      }
      return restored ? json({ ranked: ['MECH60009'] }) : notFound();
    });
    const { status, done } = await mountReady();

    let result: unknown;
    await act(async () => {
      result = await api.recommendations(ID);
    });
    expect(result).toEqual({ ranked: ['MECH60009'] });
    expect(status()).toBe('ready');
    expect(calls.filter((c) => c.method !== 'GET' || c.path !== `/api/sessions/${ID}`).map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET /api/sessions/${ID}/recommendations`,
      `POST /api/sessions/${ID}/restore`,
      `GET /api/sessions/${ID}/recommendations`,
    ]);

    // The snapshot carries what the student built, and nothing staff-side.
    const snapshot = JSON.parse(calls.find((c) => c.path.endsWith('/restore'))!.body!) as Record<string, unknown>;
    expect(snapshot).toMatchObject({ mode: 'PLAN', shortlist: session.shortlist, profile: session.profile, messages: session.messages });
    expect(snapshot).not.toHaveProperty('escalations');
    expect(snapshot).not.toHaveProperty('exceptions');
    expect(snapshot).not.toHaveProperty('escalationDraft');
    expect(snapshot).not.toHaveProperty('id');
    await done();
  });

  it('keeps restoring while retries land on instances that have not had the session yet', async () => {
    let restores = 0;
    mockFetch((call) => {
      if (call.path.endsWith('/restore')) {
        restores += 1;
        return json(session, 201);
      }
      // The first retry lands on yet another instance; the second finds one that was restored.
      return restores >= 2 ? json({ ok: true }) : notFound();
    });
    const { status, done } = await mountReady();
    await act(async () => {
      await api.setWeights(ID, session.weights as never);
    });
    expect(restores).toBe(2);
    expect(status()).toBe('ready');
    await done();
  });

  it('falls back to "This demo server restarted" when the restore itself fails', async () => {
    mockFetch((call) => (call.path.endsWith('/restore') ? json({ error: 'boom' }, 500) : notFound()));
    const { status, done } = await mountReady();
    await act(async () => {
      await api.recommendations(ID).catch(() => undefined);
    });
    expect(status()).toBe('lost');
    await done();
  });
});
