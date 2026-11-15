// Issue 63: the calendar file of the mock week, built in the browser and marked provisional throughout.
import type { Slot } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { buildIcs, byDay, fold } from './exportPlan.ts';

const slot = (overrides: Partial<Slot>): Slot => ({
  moduleId: 'MECH60009',
  term: 'spring',
  day: 'tue',
  start: '14:00',
  end: '17:00',
  kind: 'lab',
  provisional: false,
  probability: 1,
  sessionKey: 'MECH60009:spring:lab',
  ...overrides,
});

const opts = {
  titleFor: (id: string) => (id === 'MECH60009' ? 'Embedded C for Microcontrollers A' : `Module ${id}`),
  codeFor: (id: string) => id,
  now: new Date('2026-11-15T09:00:00Z'),
};

describe('buildIcs', () => {
  const ics = buildIcs(
    [slot({}), slot({ moduleId: 'IEX-ML', term: 'autumn', day: 'thu', start: '16:00', end: '18:00', kind: 'lecture', provisional: true, probability: 0.6, sessionKey: 'IEX-ML:autumn:lecture' })],
    opts,
  );
  const lines = ics.split('\r\n');

  it('is a calendar of weekly, tentative events in UK local time', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/London');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines.filter((l) => l === 'STATUS:TENTATIVE')).toHaveLength(2);
  });

  it('starts each session on its weekday in the first week of its term, for the term', () => {
    // Spring starts Monday 11 January 2027, so the Tuesday lab first runs on the 12th, for 11 weeks.
    expect(ics).toContain('DTSTART;TZID=Europe/London:20270112T140000');
    expect(ics).toContain('DTEND;TZID=Europe/London:20270112T170000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;COUNT=11');
    // Autumn starts Monday 5 October 2026, so Thursday is the 8th.
    expect(ics).toContain('DTSTART;TZID=Europe/London:20261008T160000');
  });

  it('says provisional on every event, with the chance for a provisional time', () => {
    expect(ics).toContain('SUMMARY:MECH60009 Embedded C for Microcontrollers A (lab\\, provisional)');
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded.match(/DESCRIPTION:Provisional\\, based on previous years/g)).toHaveLength(2);
    expect(unfolded).toContain('60% chance');
  });

  it('folds lines longer than 75 characters', () => {
    expect(lines.every((l) => l.length <= 75)).toBe(true);
  });

  it('folds by UTF-8 bytes without splitting a character', () => {
    const encoded = (l: string) => new TextEncoder().encode(l).length;
    const line = `SUMMARY:${'Thermodynamique appliquée – éléments ✓ '.repeat(4)}`;
    const folded = fold(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    expect(folded.every((l) => encoded(l) <= 75)).toBe(true);
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(line);
    const unicode = buildIcs([slot({})], { ...opts, titleFor: () => 'Ingénierie des systèmes énergétiques – modélisation avancée ✓✓✓' });
    expect(unicode.split('\r\n').every((l) => encoded(l) <= 75)).toBe(true);
  });
});

describe('byDay', () => {
  it('lists Monday to Friday, each in time order', () => {
    const days = byDay([slot({ day: 'mon', start: '15:00' }), slot({ day: 'mon', start: '09:00' }), slot({ day: 'fri' })]);
    expect(days.map((d) => d.day)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(days[0]?.slots.map((s) => s.start)).toEqual(['09:00', '15:00']);
  });
});
