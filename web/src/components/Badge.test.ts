// Guards the Badge (issue #141): each tone matches the tokens it declares, its text keeps 4.5:1 or better in light
// and dark (read from the real token values in index.css), and violet is kept for AI.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BADGE_TONES, badgeClass, type BadgeTone } from './Badge.tsx';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

/** `--color-name: #rrggbb` pairs in one block of index.css. */
function tokens(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}
const light = tokens(css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme'))));
const darkStart = css.indexOf(":root[data-theme='dark']");
const dark = new Map([...light, ...tokens(css.slice(darkStart, css.indexOf('}', darkStart)))]);

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = ([r, g, b]: number[]) => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const blend = (tint: number[], under: number[], alpha: number) => tint.map((c, i) => Math.round(c * alpha + under[i]! * (1 - alpha)));

const TONES = Object.keys(BADGE_TONES) as BadgeTone[];

describe('Badge', () => {
  it('uses classes that match the tokens each tone declares', () => {
    for (const tone of TONES) {
      const { soft, outline, colours } = BADGE_TONES[tone];
      expect(soft).toContain(`text-${colours.text}`);
      expect(outline).toContain(`text-${colours.text}`);
      expect(soft).toContain(colours.alpha === 1 ? `bg-${colours.tint}` : `bg-${colours.tint}/${Math.round(colours.alpha * 100)}`);
    }
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('keeps 4.5:1 or better in %s, soft and outline, on the surface and the canvas', (_theme, palette) => {
    for (const tone of TONES) {
      const { text, tint, alpha } = BADGE_TONES[tone].colours;
      for (const under of ['surface', 'canvas']) {
        const page = rgb(palette.get(under)!);
        const soft = blend(rgb(palette.get(tint)!), page, alpha);
        expect(contrast(rgb(palette.get(text)!), soft), `${tone} soft on ${under}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(rgb(palette.get(text)!), page), `${tone} outline on ${under}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('has one radius and no uppercase, at every size', () => {
    for (const size of ['sm', 'md'] as const) {
      const classes = badgeClass({ size });
      expect(classes).toContain('rounded-full');
      expect(classes).not.toMatch(/uppercase|rounded-md/);
    }
  });

  it('keeps violet for AI alone', () => {
    expect(TONES.filter((tone) => BADGE_TONES[tone].soft.includes('mode-explain'))).toEqual(['ai']);
  });
});
