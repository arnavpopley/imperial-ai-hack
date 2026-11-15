// @vitest-environment happy-dom
/// <reference types="node" />
// Issue #65: axe-core on the components it flagged (unanswered profile meters, a sub-score with no pathway, the
// staff stat tiles, the shortlist toggle and the weight sliders), plus the colour tokens' contrast in both themes.
// Colour contrast needs real layout, so it is checked here from the theme tokens rather than by axe.
import axe from 'axe-core';
import { existsSync, readFileSync } from 'node:fs';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RangeSlider } from './components/RangeSlider.tsx';
import { SubScoreBars } from './components/SubScoreBars.tsx';
import { StatTile } from './staff/components/ui.tsx';
import { ShortlistButton } from './student/catalogue/ShortlistButton.tsx';
import { ScaleTrack } from './student/profile/ProfilePanel.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Read from disk: Vitest turns CSS imports, ?raw included, into empty modules.
// The test runs from web/ (npm test) or the repo root (vitest run web).
const css = readFileSync(existsSync('src/index.css') ? 'src/index.css' : 'web/src/index.css', 'utf8');

/** The structural rules issue #65 found failing, and their close relatives. */
const RULES = [
  'aria-required-attr',
  'aria-allowed-attr',
  'aria-prohibited-attr',
  'aria-valid-attr-value',
  'aria-meter-name',
  'role-img-alt',
  'definition-list',
  'dlitem',
  'label-content-name-mismatch',
  'button-name',
  'label',
];

let root: Root | null = null;
let host: HTMLElement | null = null;

async function audit(ui: ReactNode) {
  host = document.createElement('main');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(ui));
  const result = await axe.run(host, { runOnly: { type: 'rule', values: RULES } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`);
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('axe on the components from issue #65', () => {
  it('an unanswered profile scale is not a meter without a value', async () => {
    expect(await audit(<ScaleTrack value={null} low="Exams" high="Coursework" label="Assessment" />)).toEqual([]);
    expect(document.querySelector('[role="meter"]')).toBeNull();
    expect(document.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Assessment: not answered yet');
  });

  it('an answered profile scale is a meter with its value', async () => {
    expect(await audit(<ScaleTrack value={0.7} low="Exams" high="Coursework" label="Assessment" />)).toEqual([]);
    expect(document.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('70');
  });

  it('sub-score bars with no pathway chosen', async () => {
    expect(await audit(<SubScoreBars sub={{ interest: 0.8, goal: null, style: 0.5, breadth: 0.2 }} variant="compact" dimmed />)).toEqual([]);
  });

  it('staff stat tiles form a valid description list', async () => {
    const icon = <svg aria-hidden="true" />;
    expect(
      await audit(
        <dl>
          <StatTile label="Shortlisted" value={12} hint="this term" icon={icon} />
          <StatTile label="Clashing pairs" value={3} />
        </dl>,
      ),
    ).toEqual([]);
  });

  it('the shortlist toggle names the module after its visible label', async () => {
    for (const shortlisted of [false, true]) {
      expect(await audit(<ShortlistButton title="Fluid Mechanics 3A" shortlisted={shortlisted} pending={false} onToggle={() => {}} />)).toEqual([]);
      act(() => root?.unmount());
      host?.remove();
    }
  });

  it('a weight slider speaks its level and its share', async () => {
    expect(
      await audit(<RangeSlider label="Interest" value={0.45} valueText="High" ariaValueText="High, 24% of your fit score" onChange={() => {}} />),
    ).toEqual([]);
    expect(document.querySelector('input[type="range"]')?.getAttribute('aria-valuetext')).toBe('High, 24% of your fit score');
  });
});

// ---------- contrast from the theme tokens ----------

/** The colour tokens of one theme: the @theme defaults, overridden by the dark block for dark. */
function tokens(theme: 'light' | 'dark'): Record<string, string> {
  const read = (block: string) => Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
  // The @theme block's colour tokens come before its nested @keyframes.
  const light = read(css.slice(css.indexOf('@theme'), css.indexOf('@keyframes', css.indexOf('@theme'))));
  if (theme === 'light') return light;
  const start = css.indexOf(":root[data-theme='dark']");
  return { ...light, ...read(css.slice(start, css.indexOf('}', start))) };
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe.each(['light', 'dark'] as const)('text contrast in the %s theme', (theme) => {
  const t = tokens(theme);

  it('reads the theme tokens', () => {
    for (const name of ['ink', 'muted', 'surface', 'surface-2', 'canvas', 'brand']) expect(t[name], name).toMatch(/^#[0-9a-f]{6}$/);
  });

  // Ineligible cards keep body text and the reason in ink or muted on surface, surface-2 or the canvas.
  it.each(['ink', 'muted', 'brand'])('%s text meets 4.5:1 on every background', (fg) => {
    for (const bg of ['surface', 'surface-2', 'canvas']) expect(contrast(t[fg]!, t[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});
