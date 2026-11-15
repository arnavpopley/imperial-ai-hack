// @vitest-environment happy-dom
// The "How to read these" legend (issue #138): it fits under its button inside a clipping window, and Escape closes
// the legend alone, never the drawer or dialog around it.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ProvenanceLegend, roomBelow } from './Provenance.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });

describe('roomBelow', () => {
  it('stops at a container that hides its overflow, such as the advisor window', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const windowBox = document.createElement('div');
    windowBox.style.overflow = 'hidden';
    const button = document.createElement('button');
    windowBox.append(button);
    document.body.append(windowBox);
    windowBox.getBoundingClientRect = () => rect(0, 400) as DOMRect;
    button.getBoundingClientRect = () => rect(60, 84) as DOMRect;
    // 400 (the window's bottom) - 84 (the button's) - 8 (the gap) - 16 (the edge).
    expect(roomBelow(button)).toBe(292);
    // Never less than a usable scrolling panel.
    button.getBoundingClientRect = () => rect(380, 396) as DOMRect;
    expect(roomBelow(button)).toBe(120);
    windowBox.remove();
  });
});

describe('ProvenanceLegend', () => {
  it('closes on Escape without letting the surrounding dialog see the key', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    let outerSawEscape = false;
    host.addEventListener('keydown', () => {
      outerSawEscape = true;
    });
    const root = createRoot(host);
    await act(async () => root.render(<ProvenanceLegend />));
    const button = host.querySelector('button')!;
    await act(async () => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    await act(async () => {
      button.dispatchEvent(escape);
    });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(escape.defaultPrevented).toBe(true);
    expect(outerSawEscape).toBe(false);
    await act(async () => root.unmount());
    host.remove();
  });
});
