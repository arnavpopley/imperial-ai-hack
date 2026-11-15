// Guards compare selection, the advisor prompt and the timetable lines in the compare drawer.
import type { Slot } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { advisorPrompt, MAX_COMPARE, timetableLines, toggleCompare } from './compare.ts';

const slot = (over: Partial<Slot>): Slot => ({
  moduleId: 'M',
  term: 'spring',
  day: 'tue',
  start: '14:00',
  end: '16:00',
  kind: 'lecture',
  provisional: false,
  probability: 1,
  sessionKey: 'k',
  ...over,
});

describe('toggleCompare', () => {
  it('adds in order, removes, and never holds more than three', () => {
    let selected: string[] = [];
    for (const id of ['A', 'B', 'C', 'D']) selected = toggleCompare(selected, id);
    expect(selected).toEqual(['A', 'B', 'C']);
    expect(selected).toHaveLength(MAX_COMPARE);
    expect(toggleCompare(selected, 'B')).toEqual(['A', 'C']);
  });
});

describe('advisorPrompt', () => {
  it('names each module by code, so the compare tool finds them', () => {
    expect(advisorPrompt(['MECH60006', 'MECH60009'])).toBe('Compare MECH60006 and MECH60009: which suits me best?');
    expect(advisorPrompt(['A1', 'B2', 'C3'])).toBe('Compare A1, B2 and C3: which suits me best?');
  });
});

describe('timetableLines', () => {
  it('lists each distinct time once per term in calendar order, in week order, confirmed first, with a count of the rest', () => {
    const lines = timetableLines(
      [
        slot({ day: 'thu', start: '09:00', end: '11:00' }),
        slot({ day: 'tue' }),
        slot({ day: 'tue' }),
        slot({ day: 'mon', provisional: true, kind: 'lab' }),
        slot({ day: 'fri', start: '10:00', end: '11:00', kind: 'tutorial' }),
        slot({ term: 'autumn', day: 'wed', start: '11:00', end: '12:00' }),
      ],
      3,
    );
    expect(lines).toEqual([
      { term: 'Autumn', times: ['Wed 11:00–12:00 lecture'], more: 0 },
      { term: 'Spring', times: ['Tue 14:00–16:00 lecture', 'Thu 09:00–11:00 lecture', 'Fri 10:00–11:00 tutorial'], more: 1 },
    ]);
  });
});
