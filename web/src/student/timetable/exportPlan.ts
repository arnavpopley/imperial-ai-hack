// Take-away copies of the mock timetable (issue 63), built entirely in the browser: nothing leaves it except
// through the student's own download or print. Everything is labelled provisional, based on previous years.
import type { Slot, Term } from '@modulematch/shared';
import { DAY_NAMES, TERM_LABELS, WEEKDAYS } from '../labels.ts';

export const PROVISIONAL_NOTE = "Provisional, based on previous years' timetables. Check the confirmed timetable before you rely on it.";

/**
 * First Monday of each term in 2026-27 and its number of teaching weeks. Assumed from the usual Imperial
 * calendar shape, since the real dates are not in the data; the calendar file says so on every event.
 */
export const TERM_WEEKS: Record<Term, { firstMonday: string; weeks: number }> = {
  autumn: { firstMonday: '2026-10-05', weeks: 11 },
  spring: { firstMonday: '2027-01-11', weeks: 11 },
  summer: { firstMonday: '2027-04-26', weeks: 6 },
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The date of a weekday in the first week of a term, as YYYYMMDD. */
function firstDate(term: Term, day: Slot['day']): string {
  const [y, m, d] = TERM_WEEKS[term].firstMonday.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + WEEKDAYS.indexOf(day)));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

const time = (hhmm: string) => `${hhmm.replace(':', '')}00`;

/** RFC 5545 text: escape backslashes, semicolons, commas and newlines. */
const icsText = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** RFC 5545 folds lines longer than 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

/** UK local time (GMT in winter, BST in summer), so every calendar app places the sessions at the stated times. */
const LONDON = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/London',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:BST',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:GMT',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export interface IcsOptions {
  titleFor: (moduleId: string) => string;
  codeFor: (moduleId: string) => string;
  /** Fixes DTSTAMP, for tests. */
  now?: Date;
}

/**
 * An .ics calendar of the mock week: one weekly recurring event per session for its term's teaching weeks,
 * in UK local time. Every event says it is provisional, and a provisional candidate time carries its chance.
 */
export function buildIcs(slots: readonly Slot[], { titleFor, codeFor, now = new Date() }: IcsOptions): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = slots.flatMap((slot) => {
    const date = firstDate(slot.term, slot.day);
    const chance = slot.provisional ? ` This time has a ${Math.round(slot.probability * 100)}% chance, from past years.` : '';
    return [
      'BEGIN:VEVENT',
      `UID:${icsText(`${slot.moduleId}-${slot.sessionKey}-${slot.day}-${slot.start}`)}@modulematch`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/London:${date}T${time(slot.start)}`,
      `DTEND;TZID=Europe/London:${date}T${time(slot.end)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${TERM_WEEKS[slot.term].weeks}`,
      `SUMMARY:${icsText(`${codeFor(slot.moduleId)} ${titleFor(slot.moduleId)} (${slot.kind}, provisional)`)}`,
      `DESCRIPTION:${icsText(`${PROVISIONAL_NOTE}${chance} Term dates are assumed.`)}`,
      'STATUS:TENTATIVE',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ];
  });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ModuleMatch//Mock timetable//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:ModuleMatch mock timetable (provisional)',
    ...LONDON,
    ...events,
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')
    .concat('\r\n');
}

/** Sessions grouped by weekday in week order, each day sorted by start time, for the printable week. */
export function byDay(slots: readonly Slot[]): { day: Slot['day']; name: string; slots: Slot[] }[] {
  return WEEKDAYS.map((day) => ({
    day,
    name: DAY_NAMES[day],
    slots: slots.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start) || a.moduleId.localeCompare(b.moduleId)),
  }));
}

export const termLabel = (term: Term) => `${TERM_LABELS[term]} term`;
