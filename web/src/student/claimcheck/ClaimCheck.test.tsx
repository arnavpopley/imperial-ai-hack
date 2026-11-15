// @vitest-environment happy-dom
// Issue #113: after the first answer the checking plan is a small icon button, which opens the same plan.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ClaimCheck } from './ClaimCheck.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ClaimCheck compact', () => {
  it('shows an icon button with the label as its name, and opens the full plan', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ClaimCheck compact kind="answer" text="It is assessed by coursework." sourceUrl="https://example.org/module" />));

    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Check this answer');
    expect(button.textContent).toBe('');
    expect(container.querySelector('[role="region"]')).toBeNull();

    await act(async () => button.click());
    expect(container.querySelector('[role="region"]')).not.toBeNull();
    expect(container.textContent).toContain('Where to check it');

    act(() => root.unmount());
    container.remove();
  });
});
