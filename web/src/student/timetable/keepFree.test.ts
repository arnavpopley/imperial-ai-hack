// The words beside kept-free time on the timetable: "Wednesday afternoon: you asked to keep this free".
import { describe, expect, it } from 'vitest';
import { formatEvidenceValue, halfDayLabel, keepFreeLabel } from '../labels.ts';

describe('kept-free labels', () => {
  it('names whole days, half days and the earliest start', () => {
    expect(keepFreeLabel({ day: 'fri', from: '00:00', to: '23:59', reason: 'day' })).toBe('Friday');
    expect(keepFreeLabel({ day: 'wed', from: '12:00', to: '23:59', reason: 'half-day' })).toBe('Wednesday afternoon');
    expect(keepFreeLabel({ day: 'mon', from: '00:00', to: '12:00', reason: 'half-day' })).toBe('Monday morning');
    expect(keepFreeLabel({ day: 'tue', from: '00:00', to: '10:00', reason: 'early' })).toBe('Before 10:00');
  });

  it('reads half-day evidence values as words', () => {
    expect(halfDayLabel('thu-pm')).toBe('Thursday afternoon');
    expect(formatEvidenceValue(['wed-pm', 'fri'])).toBe('Wednesday afternoon, Friday');
  });
});
