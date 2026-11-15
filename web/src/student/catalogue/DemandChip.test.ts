import { describe, expect, it } from 'vitest';
import { demandText } from './DemandChip.tsx';

describe('demand chip text', () => {
  it('says popular when oversubscribed and nearly full when close to capacity', () => {
    expect(demandText({ moduleId: 'M', status: 'over', shortlisted: 63, capacity: 48 })).toBe(
      'Popular: 63 shortlists for 48 places',
    );
    expect(demandText({ moduleId: 'M', status: 'near', shortlisted: 56, capacity: 60 })).toBe(
      'Nearly full: 56 shortlists for 60 places',
    );
  });
});
