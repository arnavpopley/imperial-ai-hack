// Guards the Provenance chips (issue #138): each tone matches the tokens it declares, and its text keeps 4.5:1 or
// better against its tint in light and dark, read from the real token values in index.css.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legendOffset, PROVENANCE, type ProvenanceKind } from './Provenance.tsx';

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
/** The tint laid over a surface at its alpha. */
const blend = (tint: number[], under: number[], alpha: number) => tint.map((c, i) => Math.round(c * alpha + under[i]! * (1 - alpha)));

const KINDS = Object.keys(PROVENANCE) as ProvenanceKind[];

describe('Provenance chips', () => {
  it('use classes that match the tokens they declare', () => {
    for (const kind of KINDS) {
      const { tone, colours } = PROVENANCE[kind];
      expect(tone).toContain(`text-${colours.text}`);
      expect(tone).toContain(colours.alpha === 1 ? `bg-${colours.tint}` : `bg-${colours.tint}/${Math.round(colours.alpha * 100)}`);
    }
  });

  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('keep 4.5:1 or better in %s, on the surface and on the canvas', (_theme, palette) => {
    for (const kind of KINDS) {
      const { text, tint, alpha } = PROVENANCE[kind].colours;
      for (const under of ['surface', 'canvas']) {
        const background = blend(rgb(palette.get(tint)!), rgb(palette.get(under)!), alpha);
        expect(contrast(rgb(palette.get(text)!), background), `${kind} on ${under}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keep the legend panel inside the window wherever its button sits', () => {
    // Room under the button on a desktop: it opens there.
    expect(legendOffset(400, 1440)).toEqual({ left: 0, width: 288 });
    // A button mid-row on a phone: shifted left so the panel ends 16px from the right edge.
    expect(legendOffset(133, 390)).toEqual({ left: -(133 + 288 - 374), width: 288 });
    // A very narrow window: the panel narrows and starts 16px from the left edge.
    expect(legendOffset(200, 300)).toEqual({ left: 16 - 200, width: 268 });
  });

  it('keep violet for AI alone', () => {
    const violet = KINDS.filter((kind) => PROVENANCE[kind].tone.includes('mode-explain'));
    expect(violet).toEqual(['ai']);
  });
});
