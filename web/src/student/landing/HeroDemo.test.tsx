// @vitest-environment happy-dom
// Issue #135: under prefers-reduced-motion the hero shows its final frame at once (the full quote, the fit ring at
// its score, the "Your words" reason and the resolved clash), and the picture is inert, so nothing in it is
// focusable. The How it works hero shows the whole path.
import { MotionGlobalConfig } from 'motion/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MiniFlow } from '../../trace/MiniFlow.tsx';
import { HERO_FIT, HeroDemo } from './HeroDemo.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const realMatchMedia = window.matchMedia;
beforeAll(() => {
  // Report reduced motion, as the operating system setting would.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterAll(() => {
  window.matchMedia = realMatchMedia;
});

async function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, done: () => act(() => root.unmount()) };
}

describe('HeroDemo under reduced motion', () => {
  it('shows the final frame at once', async () => {
    const { container, done } = await render(<HeroDemo />);
    const text = container.textContent ?? '';
    expect(text).toContain('“I loved the control systems lab”');
    expect(text).toContain(String(HERO_FIT));
    expect(text).toContain('Your words');
    expect(text).toContain('No clashes');
    expect(text).not.toContain('Certain clash');
    done();
  });

  it('is a picture: inert and hidden, with a text description for screen readers', async () => {
    const { container, done } = await render(<HeroDemo />);
    const picture = container.querySelector('[inert]');
    expect(picture?.getAttribute('aria-hidden')).toBe('true');
    expect(picture?.querySelector('button')).not.toBeNull();
    expect(container.querySelector('figcaption')?.textContent).toContain('resolved with a swap');
    done();
  });
});

describe('MiniFlow', () => {
  it('shows the whole path from message to reply', async () => {
    const { container, done } = await render(<MiniFlow />);
    const text = container.textContent ?? '';
    for (const stop of ['Your message', '4 checks in', 'Supervisor', 'One agent', '4 checks out', 'Reply']) expect(text).toContain(stop);
    done();
  });
});
