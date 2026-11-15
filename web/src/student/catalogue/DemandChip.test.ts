import { capacityStatus } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { CAPACITY_LABEL } from '../../staff/lib/format.ts';
import { demandText } from './DemandChip.tsx';

describe('demand chip text', () => {
  it('says over capacity when oversubscribed and near capacity when close to it, never softer for the worse state', () => {
    expect(demandText({ moduleId: 'M', status: 'over', shortlisted: 63, capacity: 48 })).toBe(
      'Over capacity: 63 shortlists for 48 places',
    );
    expect(demandText({ moduleId: 'M', status: 'near', shortlisted: 56, capacity: 60 })).toBe(
      'Near capacity: 56 shortlists for 60 places',
    );
  });

  it('uses the staff console words and the shared threshold for the same module', () => {
    // Embedded C (63 for 48) and Automotive Design (56 for 60) from the issue, through the one shared threshold.
    for (const [shortlisted, capacity] of [
      [63, 48],
      [56, 60],
    ] as const) {
      const status = capacityStatus(shortlisted, capacity);
      if (status !== 'over' && status !== 'near') throw new Error(`expected a capacity signal for ${shortlisted}/${capacity}`);
      expect(demandText({ moduleId: 'M', status, shortlisted, capacity })).toBe(`${CAPACITY_LABEL[status]}: ${shortlisted} shortlists for ${capacity} places`);
    }
  });
});
