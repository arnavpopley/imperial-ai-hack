// Guards the bubble cloud's no-overlap layout and its word-boundary labels.
// Run with: npx vitest run --root web src/student/societies
import { describe, expect, it } from 'vitest';
import { cloudLayout, INNER_MAX, INNER_MIN, MAX_PER_RING, MIN_GAP, OUTER_DIAMETER, smallestGap, splitLabel, WILDCARD_DIAMETER } from './cloudLayout.ts';

/** Floating-point slack: the edge gap is exactly MIN_GAP by construction. */
const EPSILON = 1e-9;

describe('cloudLayout', () => {
  for (let inner = 0; inner <= MAX_PER_RING; inner++) {
    for (let outer = 0; outer <= 9; outer++) {
      it(`keeps ${inner} inner and ${outer} outer bubbles at least ${MIN_GAP}% apart at the largest sizes`, () => {
        const layout = cloudLayout(Array<number>(inner).fill(INNER_MAX), outer);
        const all = [...layout.inner, ...layout.outer];
        if (all.length > 0) expect(smallestGap(all)).toBeGreaterThanOrEqual(MIN_GAP - EPSILON);
      });
    }
  }

  it('gives every outer bubble a gap of its own, never more than the inner ring holds', () => {
    expect(cloudLayout(Array<number>(6).fill(INNER_MIN), 9).outer).toHaveLength(6);
    expect(cloudLayout(Array<number>(3).fill(WILDCARD_DIAMETER), 9).outer).toHaveLength(3);
    expect(cloudLayout([], 9).outer).toHaveLength(1);
  });

  it('caps the inner ring and uses the given diameters', () => {
    const layout = cloudLayout([18, 19, 20, 21, 22, 20, 22], 0);
    expect(layout.inner).toHaveLength(MAX_PER_RING);
    expect(layout.inner.map((p) => p.diameter)).toEqual([18, 19, 20, 21, 22, 20]);
    expect(cloudLayout([20], 1).outer[0]?.diameter).toBe(OUTER_DIAMETER);
  });

  it('reports an overlap as a negative gap', () => {
    expect(smallestGap([{ x: 40, y: 50, diameter: 20 }, { x: 45, y: 50, diameter: 20 }])).toBeLessThan(0);
  });
});

describe('splitLabel', () => {
  const names = ['Prototyping and Hacking Society', 'Autonomous Underwater Vehicle', 'Mechanical Engineering', 'Racing', 'A B C D E F'];

  for (const name of names) {
    for (const maxLines of [1, 2, 3]) {
      it(`keeps every word of "${name}" whole within ${maxLines} line(s)`, () => {
        const lines = splitLabel(name, maxLines);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.length).toBeLessThanOrEqual(maxLines);
        expect(lines.join(' ')).toBe(name);
      });
    }
  }

  it('balances lines so the longest is as short as possible', () => {
    expect(splitLabel('Autonomous Underwater Vehicle', 3)).toEqual(['Autonomous', 'Underwater', 'Vehicle']);
    expect(splitLabel('Prototyping and Hacking Society', 2)).toEqual(['Prototyping and', 'Hacking Society']);
    expect(splitLabel('Mechanical Engineering', 2)).toEqual(['Mechanical', 'Engineering']);
  });

  it('handles empty and extra whitespace', () => {
    expect(splitLabel('', 2)).toEqual([]);
    expect(splitLabel('  Space   Society ', 2)).toEqual(['Space', 'Society']);
  });
});
