// @vitest-environment happy-dom
// On the public demo a server instance can lose a session (each instance keeps its own database). A 404 "session
// not found" on a known session must end in a "start again" screen, never a page that waits forever.
import { MotionGlobalConfig } from 'motion/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api.ts';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { readStoredSessionId, writeStoredSessionId } from './state/storage.ts';
import { StudentApp } from './StudentApp.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// happy-dom cancels Web Animations on unmount, which motion reports as an unhandled AbortError.
MotionGlobalConfig.skipAnimations = true;

const notFound = () => new Response(JSON.stringify({ error: 'session not found' }), { status: 404 });

/** A fetch that answers 404 "session not found" for session routes, empty lists elsewhere, and records the paths. */
function mockFetch(session: (path: string) => Response) {
  const paths: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    paths.push(path);
    if (path.startsWith('/api/sessions/')) return session(path);
    return new Response('[]', { status: 200 });
  });
  return paths;
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function render(node: React.ReactNode, at: string) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemoryRouter initialEntries={[at]}>{node}</MemoryRouter>));
  await settle();
  return { container, done: () => act(() => root.unmount()) };
}

afterEach(() => {
  vi.restoreAllMocks();
  writeStoredSessionId(null);
  document.body.innerHTML = '';
});

describe('a session the server no longer knows', () => {
  it('shows "start again" on resume, and the button clears the session and goes to onboarding', async () => {
    writeStoredSessionId('gone-1');
    mockFetch(notFound);
    function Where() {
      return <p data-testid="where">{useLocation().pathname}</p>;
    }
    const { container, done } = await render(
      <>
        <StudentApp />
        <Where />
      </>,
      '/catalogue',
    );
    expect(container.textContent).toContain('This demo server restarted');
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Start again');
    expect(button).toBeDefined();

    await act(async () => button!.click());
    await settle();
    expect(readStoredSessionId()).toBeNull();
    expect(container.textContent).not.toContain('This demo server restarted');
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe('/start');
    await done();
  });

  it('turns a 404 on any later request into the lost state, while other failures stay ordinary errors', async () => {
    writeStoredSessionId('gone-2');
    mockFetch((path) =>
      path.endsWith('/gone-2') ? new Response(JSON.stringify({ id: 'gone-2', escalations: [] }), { status: 200 }) : notFound(),
    );
    function Status() {
      return <p data-testid="status">{useSession().status}</p>;
    }
    const { container, done } = await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
      '/catalogue',
    );
    const status = () => container.querySelector('[data-testid="status"]')?.textContent;
    expect(status()).toBe('ready');

    // A 404 for another reason (an unknown module, say) is not a lost session.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'module not found' }), { status: 404 }));
    await act(async () => {
      await api.moduleSummary('ZZZ').catch(() => undefined);
    });
    expect(status()).toBe('ready');

    // A late 404 from a session the student has already left (another id) is ignored.
    await act(async () => {
      await api.results('old-session').catch(() => undefined);
    });
    expect(status()).toBe('ready');

    await act(async () => {
      await api.recommendations('gone-2').catch(() => undefined);
    });
    expect(status()).toBe('lost');
    await done();
  });
});
