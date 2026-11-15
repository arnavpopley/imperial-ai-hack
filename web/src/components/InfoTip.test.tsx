// @vitest-environment happy-dom
// The "i" note opens on focus, hover and tap (a tap never closes it), closes on Escape, blur and pointer leave, and is linked to its button
// with aria-describedby only while it is showing.
import { MotionGlobalConfig } from 'motion/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InfoTip } from './InfoTip.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let container: HTMLDivElement;
let unmount: () => void;

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<InfoTip label="About capacity">Turns amber at 85%.</InfoTip>));
  unmount = () => act(() => root.unmount());
});

afterEach(() => {
  unmount();
  container.remove();
});

const button = () => container.querySelector('button')!;
const note = () => container.querySelector<HTMLElement>('[role="tooltip"]');
const fire = (target: Element, event: Event) => act(async () => void target.dispatchEvent(event));

describe('InfoTip', () => {
  it('is a named button with the note hidden at first', () => {
    expect(button().getAttribute('aria-label')).toBe('About capacity');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(note()).toBeNull();
  });

  it('opens on focus, links the note, and closes on Escape', async () => {
    await act(async () => button().focus());
    expect(note()?.textContent).toBe('Turns amber at 85%.');
    expect(button().getAttribute('aria-describedby')).toBe(note()!.id);
    await fire(button(), new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(note()).toBeNull();
    expect(button().hasAttribute('aria-describedby')).toBe(false);
  });

  it('stays open after a tap, which focuses then clicks, and closes when focus moves away', async () => {
    await act(async () => button().focus());
    await fire(button(), new MouseEvent('click', { bubbles: true }));
    expect(note()).not.toBeNull();
    await act(async () => button().blur());
    expect(note()).toBeNull();
  });

  it('reopens with a tap after Escape', async () => {
    await act(async () => button().focus());
    await fire(button(), new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fire(button(), new MouseEvent('click', { bubbles: true }));
    expect(note()).not.toBeNull();
  });

  it('opens while the pointer is over it', async () => {
    const wrapper = button().parentElement!;
    await fire(wrapper, new MouseEvent('mouseover', { bubbles: true }));
    expect(note()).not.toBeNull();
    await fire(wrapper, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    expect(note()).toBeNull();
  });
});
