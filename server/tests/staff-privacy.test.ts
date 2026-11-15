// Spec 20.4 (issue 104): no staff response carries a count of one to four students, as a number or in words.
// Every GET route under /api/staff is read from the route table, so a new endpoint cannot skip this scan.
import { schemas } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { countText, partitionCounts, staffFitBands, withheld } from '../src/engines/index.ts';
import { staffRoutes } from '../src/routes/staff.ts';

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

/**
 * Numbers that are not counts of students: places, credits, scores, shares, probabilities, priorities, marks, a
 * year of study, and answer-rating tallies (ratings of AI answers, which carry no student or session).
 */
const NOT_STUDENT_COUNTS = new Set([
  'capacity',
  'ects',
  'level',
  'averageFit',
  'goodFitShare',
  'strongFitShare',
  'upliftPoints',
  'probability',
  'priority',
  'yearOfStudy',
  'maxMarks',
  'total',
  'up',
  'down',
]);

/** Phrases that state a number of students or shortlists. */
const COUNT_PHRASE =
  /\b([1-4]) (?:students?|shortlists?|more of them|of the \d+|would (?:rise|reach)|already do)\b|\(([1-4]) already do\)/;

/** Every place in a response where a count of one to four students appears. Array items take their field's name. */
function smallCounts(value: unknown, path = '$', key?: string): string[] {
  if (typeof value === 'number') {
    const counted = key === undefined || !NOT_STUDENT_COUNTS.has(key);
    return counted && Number.isInteger(value) && value >= 1 && value <= 4 ? [`${path} = ${value}`] : [];
  }
  if (typeof value === 'string') return COUNT_PHRASE.test(value) ? [`${path}: "${value}"`] : [];
  if (Array.isArray(value)) return value.flatMap((item, i) => smallCounts(item, `${path}[${i}]`, key));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([field, item]) => smallCounts(item, `${path}.${field}`, field));
  }
  return [];
}

describe('withheld and countText', () => {
  it('withhold one to four students and keep zero and five or more', () => {
    expect([0, 1, 4, 5, 12].map(withheld)).toEqual([0, null, null, 5, 12]);
    expect([0, 3, 5].map(countText)).toEqual(['0', 'fewer than 5', '5']);
  });
});

describe('partitionCounts', () => {
  it('shows a split exactly only when every part is zero or five or more', () => {
    expect(partitionCounts([12, 7, 0])).toEqual([12, 7, 0]);
    // 5 + 1 of a published 6: the 5 would pin the 1, so both are withheld; the zero part stays.
    expect(partitionCounts([5, 1, 0])).toEqual([null, null, 0]);
    expect(partitionCounts([17, 2])).toEqual([null, null]);
  });
});

describe('staffFitBands', () => {
  const LINES = [50, 70];

  it('merges small bands into their neighbours without crossing the good- and strong-fit lines', () => {
    // Below 50: 149, 50 to 69: 21, 70 and up: 30. Every stretch is large enough, so both counts stay exact.
    const { bands, above } = staffFitBands([0, 16, 105, 18, 10, 3, 18, 27, 3, 0], LINES);
    expect(bands).toEqual([
      { from: 0, to: 9, students: 0 },
      { from: 10, to: 19, students: 16 },
      { from: 20, to: 29, students: 105 },
      { from: 30, to: 39, students: 18 },
      { from: 40, to: 49, students: 10 },
      { from: 50, to: 69, students: 21 },
      { from: 70, to: 100, students: 30 },
    ]);
    expect([above.get(50), above.get(70)]).toEqual([51, 30]);
  });

  it('withholds a line’s count, and merges across it, when one to four students sit beyond it', () => {
    // 70 and up holds 1: that stretch joins 50 to 69, so the strong-fit count is withheld; the good-fit one stays.
    const { bands, above } = staffFitBands([0, 18, 76, 36, 30, 38, 1, 0, 0, 1], LINES);
    expect([above.get(50), above.get(70)]).toEqual([40, null]);
    expect(bands.at(-1)).toEqual({ from: 50, to: 100, students: 40 });
  });

  it('always publishes bands of zero or at least five that cover 0 to 100 and add up to the cohort', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 500; run++) {
      const histogram = Array.from({ length: 10 }, () => (random() < 0.4 ? Math.floor(random() * 5) : Math.floor(random() * 40)));
      const total = histogram.reduce((a, b) => a + b, 0);
      if (total < 5) continue;
      const { bands, above } = staffFitBands(histogram, LINES);
      expect(bands.every((b) => b.students === 0 || b.students >= 5), String(histogram)).toBe(true);
      expect(bands.reduce((a, b) => a + b.students, 0)).toBe(total);
      expect(bands[0]!.from).toBe(0);
      expect(bands.at(-1)!.to).toBe(100);
      bands.slice(1).forEach((b, i) => expect(b.from).toBe(bands[i]!.to + 1));
      for (const line of LINES) {
        const count = above.get(line);
        if (count === null || count === undefined) continue;
        // A published count adds nothing the bands do not show: no band crosses its line, and it is their sum.
        expect(bands.some((b) => b.from < line && b.to >= line), `${histogram} @${line}`).toBe(false);
        expect(count).toBe(bands.filter((b) => b.from >= line).reduce((a, b) => a + b.students, 0));
      }
    }
  });
});

describe('smallCounts', () => {
  it('finds counts in fields, arrays and text, and ignores fields that are not counts of students', () => {
    const response = {
      shortlisted: 2,
      capacity: 3,
      fitHistogram: [0, 4, 9, null],
      probability: 1,
      headline: 'Only 3 students shortlisted it',
      detail: '19 students; fit 70; number 3 of the top 10 clash pairs',
    };
    expect(smallCounts(response)).toEqual([
      '$.shortlisted = 2',
      '$.fitHistogram[1] = 4',
      '$.headline: "Only 3 students shortlisted it"',
    ]);
  });
});

describe('every /api/staff GET response withholds counts of one to four students', () => {
  let moduleIds: string[] = [];

  beforeAll(async () => {
    seedIfEmpty();
    // Give the staff views something individual to show: a student with a shortlist and an escalation.
    const created = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    const sid = schemas.SessionState.parse(await created.json()).id;
    await app.request(`/api/sessions/${sid}/shortlist`, json({ moduleId: 'MECH60018', action: 'add' }));
    await app.request(`/api/sessions/${sid}/escalations`, json({ type: 'RULE_EXCEPTION', summary: 'Can I take it?' }));
    moduleIds = schemas.StaffModuleSummary.array()
      .parse(await (await app.request('/api/staff/modules')).json())
      .map((m) => m.moduleId);
  });

  it('scans every GET route in the staff route table, for every module', async () => {
    const paths = [...new Set(staffRoutes.routes.filter((r) => r.method === 'GET').map((r) => r.path))];
    // The routes this test knows how to fill in; a new one fails here until it is added.
    expect(paths.sort()).toEqual(
      [
        '/escalations',
        '/feedback',
        '/feedback/export',
        '/modules',
        '/modules/:id/exam-form',
        '/modules/:id/insights',
        '/timetable/clash-priorities',
      ].sort(),
    );
    const urls = paths.flatMap((path) => (path.includes(':id') ? moduleIds.map((id) => path.replace(':id', id)) : [path]));
    const found: string[] = [];
    for (const url of urls) {
      const res = await app.request(`/api/staff${url}`);
      expect(res.ok, url).toBe(true);
      const text = await res.text();
      const body: unknown = url.endsWith('/export') ? text.split('\n').filter(Boolean).map((line) => JSON.parse(line)) : JSON.parse(text);
      found.push(...smallCounts(body).map((hit) => `${url} ${hit}`));
    }
    expect(found).toEqual([]);
  }, 60_000);

  it('still sends zero, and counts of five or more, as numbers', async () => {
    const rows = schemas.StaffModuleSummary.array().parse(await (await app.request('/api/staff/modules')).json());
    expect(rows.some((r) => r.shortlisted === 0)).toBe(true);
    expect(rows.some((r) => (r.shortlisted ?? 0) >= 5)).toBe(true);
    expect(rows.some((r) => r.shortlisted === null)).toBe(true);
    expect(rows.some((r) => r.fitBands.some((b) => b.to - b.from > 10))).toBe(true);
  });
});
