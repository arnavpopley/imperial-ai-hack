// @vitest-environment happy-dom
// Issue #113: after the first answer the checking plan is a small icon button, which opens the same plan.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ClaimCheck } from './ClaimCheck.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ClaimCheck compact', () => {
  it('shows an icon button named by its label, opens the full plan, and keeps focus on the same button', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ClaimCheck compact kind="answer" text="It is assessed by coursework." sourceUrl="https://example.org/module" />));

    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('Check this answer');
    expect(button.querySelector('.sr-only')?.textContent).toBe('Check this answer');
    expect(container.querySelector('[role="region"]')).toBeNull();

    button.focus();
    await act(async () => button.click());
    expect(container.querySelector('[role="region"]')).not.toBeNull();
    expect(container.textContent).toContain('Where to check it');
    expect(container.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);

    await act(async () => button.click());
    expect(container.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);

    act(() => root.unmount());
    container.remove();
  });
});
