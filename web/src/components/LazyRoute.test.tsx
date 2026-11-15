// @vitest-environment happy-dom
// Code splitting: a screen whose code fails to download shows a recoverable error in its place, and the rest of
// the page (here, the navigation) stays.
import { MotionGlobalConfig } from 'motion/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lazy, lazyNamed } from './LazyRoute.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// happy-dom cancels Web Animations on unmount, which motion reports as an unhandled AbortError.
MotionGlobalConfig.skipAnimations = true;

afterEach(() => {
  vi.restoreAllMocks();
});

async function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
  // Let the lazy import settle and React retry the render.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, done: () => act(() => root.unmount()) };
}

describe('Lazy', () => {
  it('renders the screen once its code has loaded', async () => {
    const Screen = lazyNamed(async () => ({ Screen: () => <p>Catalogue</p> }), 'Screen');
    const { container, done } = await render(<Lazy><Screen /></Lazy>);
    expect(container.textContent).toContain('Catalogue');
    done();
  });

  it('shows a recoverable error for a failed download and keeps the rest of the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Screen = lazyNamed<'Screen', { Screen: () => React.JSX.Element }>(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), 'Screen');
    const { container, done } = await render(
      <>
        <nav>Student sections</nav>
        <Lazy>
          <Screen />
        </Lazy>
      </>,
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('This page did not load');
    expect(container.querySelector('nav')?.textContent).toBe('Student sections');
    expect([...container.querySelectorAll('button')].some((b) => /try again/i.test(b.textContent ?? ''))).toBe(true);
    done();
  });
});
