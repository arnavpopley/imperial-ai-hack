import type { Module } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { demandSignals } from '../src/engines/demand.ts';

const mod = (id: string, capacity: number | null) => ({ id, capacity }) as Module;
/** `size` shortlists in which the first `n` students include each module. */
const lists = (counts: Record<string, number>, size = 20) =>
  Array.from({ length: size }, (_, i) => Object.entries(counts).flatMap(([id, n]) => (i < n ? [id] : [])));

describe('demand signals for students', () => {
  it('flags near-capacity and oversubscribed modules with the staff thresholds', () => {
    const signals = demandSignals(
      [mod('OVER', 10), mod('NEAR', 12), mod('CALM', 20), mod('OPEN', null)],
      lists({ OVER: 13, NEAR: 11, CALM: 8, OPEN: 18 }),
    );
    expect(signals).toEqual([
      { moduleId: 'OVER', status: 'over', shortlisted: 13, capacity: 10 },
      { moduleId: 'NEAR', status: 'near', shortlisted: 11, capacity: 12 },
    ]);
  });

  it('withholds any count under five students, and everything for a cohort under five', () => {
    expect(demandSignals([mod('TINY', 4)], lists({ TINY: 4 }))).toEqual([]);
    expect(demandSignals([mod('OVER', 2)], lists({ OVER: 4 }, 4))).toEqual([]);
  });
});
