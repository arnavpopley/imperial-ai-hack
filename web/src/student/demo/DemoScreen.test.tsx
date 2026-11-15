// @vitest-environment happy-dom
// The demo's tabs follow the ARIA tabs pattern: arrow keys (wrapping) and Home/End move between tabs and select
// them, focus follows, only the selected tab is in the Tab order, and the panel itself can be tabbed into.
import { MotionGlobalConfig } from 'motion/react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DemoScreen } from './DemoScreen.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let container: HTMLDivElement;
let unmount: () => void;

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <DemoScreen />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(() => root.unmount());
});

afterEach(() => {
  unmount();
  container.remove();
});

const tabs = () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const selected = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true');
const inTabOrder = () => tabs().filter((t) => t.tabIndex === 0);

async function press(key: string) {
  const target = document.activeElement as HTMLElement;
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

/** After every move: exactly one tab selected, it alone is in the Tab order, and it has focus. */
function expectOnly(label: string) {
  expect(selected().map((t) => t.textContent)).toEqual([label]);
  expect(inTabOrder().map((t) => t.textContent)).toEqual([label]);
  expect(document.activeElement?.textContent).toBe(label);
}

describe('demo tabs from the keyboard', () => {
  it('starts on the first tab, alone in the Tab order', () => {
    expect(tabs()).toHaveLength(4);
    expect(selected().map((t) => t.textContent)).toEqual(['What she told us']);
    expect(inTabOrder().map((t) => t.textContent)).toEqual(['What she told us']);
  });

  it('moves right and left with the arrow keys, wrapping at both ends', async () => {
    tabs()[0]!.focus();
    await press('ArrowRight');
    expectOnly('Her ranked modules');
    await press('ArrowLeft');
    expectOnly('What she told us');
    await press('ArrowLeft');
    expectOnly('Societies');
    await press('ArrowRight');
    expectOnly('What she told us');
  });

  it('jumps to the last and first tab with End and Home', async () => {
    tabs()[0]!.focus();
    await press('End');
    expectOnly('Societies');
    await press('Home');
    expectOnly('What she told us');
  });

  it('ignores other keys', async () => {
    tabs()[1]!.focus();
    await press('ArrowDown');
    expect(selected().map((t) => t.textContent)).toEqual(['What she told us']);
  });

  it('lets Tab reach the panel, which names the selected tab', async () => {
    tabs()[0]!.focus();
    await press('ArrowRight');
    const panel = container.querySelector<HTMLElement>('[role="tabpanel"]')!;
    expect(panel.tabIndex).toBe(0);
    expect(panel.getAttribute('aria-labelledby')).toBe(selected()[0]!.id);
  });
});
