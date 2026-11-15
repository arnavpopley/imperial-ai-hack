/// <reference types="node" />
// Issue #139: text uses the named type scale in index.css. This test reads every source file and fails on a font
// size under the 12px floor, or on an arbitrary text-[…] size, unless a `type-scale:` comment on the same line or
// the line above says why that one element needs it. The budgets ratchet down as the codemod lands; they can only
// go down.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Source files, read as text. Tests are left out: they may name a bad size on purpose. */
const SOURCES = Object.entries(
  import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }),
);

/** An arbitrary font size such as text-[13px] or text-[1.75rem]; colours (text-[#fff]) and var() are not sizes. */
const ARBITRARY = /text-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g;
const FLOOR_PX = 12;
/** The comment that explains a deliberate arbitrary size. */
const REASON = 'type-scale:';

/**
 * Budgets. They only go down: each codemod PR lowers them to what it leaves, and the end state is no arbitrary
 * size below the floor and at most 20 deliberate ones, each with a reason.
 */
const MAX_BELOW_FLOOR = 68;
const MAX_UNEXPLAINED = 372;
const MAX_EXPLAINED = 20;

interface Use {
  file: string;
  line: number;
  size: string;
  px: number | null;
  explained: boolean;
}

function uses(): Use[] {
  const found: Use[] = [];
  for (const [file, text] of SOURCES) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(ARBITRARY)) {
        const value = Number(m[1]);
        const px = m[2] === 'px' ? value : m[2] === 'rem' ? value * 16 : null;
        const explained = line.includes(REASON) || (lines[i - 1] ?? '').includes(REASON);
        found.push({ file: file.replace('./', 'web/src/'), line: i + 1, size: m[0], px, explained });
      }
    });
  }
  return found;
}

const where = (u: Use) => `${u.file}:${u.line} ${u.size}`;

describe('the type scale', () => {
  it('reads the source files', () => {
    expect(SOURCES.length).toBeGreaterThan(50);
  });

  it('defines every role, none under the 12px floor', () => {
    const css = readFileSync(existsSync('src/index.css') ? 'src/index.css' : 'web/src/index.css', 'utf8');
    for (const role of ['display', 'title', 'heading', 'subheading', 'body', 'small', 'caption', '2xs', 'xs', 'sm', 'base']) {
      const value = new RegExp(`--text-${role}:\\s*([^;]+);`).exec(css)?.[1];
      expect(value, role).toBeDefined();
      // A clamp() is checked at its smallest size.
      const smallest = /clamp\(\s*([\d.]+)rem/.exec(value!)?.[1] ?? /^([\d.]+)rem$/.exec(value!.trim())?.[1];
      expect(Number(smallest) * 16, role).toBeGreaterThanOrEqual(FLOOR_PX);
    }
  });

  it(`has at most ${MAX_BELOW_FLOOR} arbitrary sizes under ${FLOOR_PX}px`, () => {
    const below = uses().filter((u) => u.px !== null && u.px < FLOOR_PX);
    expect(below.length, below.map(where).join('\n')).toBeLessThanOrEqual(MAX_BELOW_FLOOR);
  });

  it(`has at most ${MAX_UNEXPLAINED} arbitrary sizes without a "${REASON}" reason`, () => {
    const unexplained = uses().filter((u) => !u.explained);
    expect(unexplained.length, unexplained.slice(0, 40).map(where).join('\n')).toBeLessThanOrEqual(MAX_UNEXPLAINED);
  });

  it(`has at most ${MAX_EXPLAINED} deliberate arbitrary sizes`, () => {
    const explained = uses().filter((u) => u.explained);
    expect(explained.length, explained.map(where).join('\n')).toBeLessThanOrEqual(MAX_EXPLAINED);
  });
});
