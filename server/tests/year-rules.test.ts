// Issue 51: eligibility follows the year of study. Years without rules data cannot confirm eligibility rather than
// allowing everything, the staff module list uses the same check as the students' recommendations, and Year 3 is
// unchanged.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { catalogue } from '../src/agents/session.ts';

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const PROGRAMME = 'MEng Mechanical Engineering';

async function sessionFor(yearOfStudy: number, completedModuleIds: string[] = []) {
  const res = await app.request('/api/sessions', json({ programme: PROGRAMME, yearOfStudy, completedModuleIds }));
  return S.SessionState.parse(await res.json()).id;
}
const recommendations = async (id: string) =>
  S.RecommendationsResponse.parse(await (await app.request(`/api/sessions/${id}/recommendations`)).json());
const levelOf = (moduleId: string) => catalogue.modules().find((m) => m.id === moduleId)!.level;

beforeAll(() => {
  seedIfEmpty();
});

describe('years without rules data', () => {
  it('a Year 1 session has no eligible Level 3 or Level 4 module, and confirms nothing else either', async () => {
    const recs = await recommendations(await sessionFor(1));
    expect(recs.rules).toMatchObject({ programme: PROGRAMME, year: 1, loaded: false, maxModuleLevel: 1 });
    expect(recs.rules.note).toContain("Year 1 aren't loaded");
    expect(recs.recommendations.filter((r) => r.eligible && levelOf(r.moduleId) >= 3)).toEqual([]);
    expect(recs.recommendations.filter((r) => r.eligible)).toEqual([]);
    for (const r of recs.recommendations) {
      // Above the year's level: refused. At it: not refused, just not confirmable.
      expect(r.unconfirmed === true).toBe(levelOf(r.moduleId) <= 1 && r.ineligibleReasons.length === 1);
    }
  });

  it('cannot shortlist a module it cannot confirm', async () => {
    const id = await sessionFor(1);
    const recs = await recommendations(id);
    const firstYear = recs.recommendations.find((r) => r.unconfirmed)!;
    const res = await app.request(`/api/sessions/${id}/shortlist`, json({ moduleId: firstYear.moduleId, action: 'add' }));
    expect(res.status).toBe(422);
  });

  it('a Senior Tutor can confirm one by approving an exception', async () => {
    const id = await sessionFor(2);
    const target = (await recommendations(id)).recommendations.find((r) => r.unconfirmed)!;
    const created = await app.request(`/api/sessions/${id}/escalations`, json({ type: 'RULE_EXCEPTION', summary: 'x', moduleId: target.moduleId, reason: 'My department confirmed it.' }));
    const escalation = S.Escalation.parse(await created.json());
    expect(escalation.request?.violations.map((v) => v.code)).toEqual(['RULES_NOT_LOADED']);
    await app.request(`/api/staff/escalations/${escalation.id}/respond`, json({ decision: 'approve' }));
    const after = (await recommendations(id)).recommendations.find((r) => r.moduleId === target.moduleId)!;
    expect(after).toMatchObject({ eligible: true, exception: 'approved' });
  });

  it('GET /programmes says which years have rules', async () => {
    const info = S.ProgrammeInfo.array().parse(await (await app.request('/api/programmes')).json());
    const years = info.find((p) => p.programme === PROGRAMME)!.years;
    expect(years).toEqual([
      { year: 1, rulesLoaded: false },
      { year: 2, rulesLoaded: false },
      { year: 3, rulesLoaded: true },
      { year: 4, rulesLoaded: true },
    ]);
  });
});

describe('Year 3 is unchanged, and staff agree with students', () => {
  it('keeps the loaded rules, the Level 4 refusal wording and no unconfirmed modules', async () => {
    const recs = await recommendations(await sessionFor(3));
    expect(recs.rules).toMatchObject({ year: 3, loaded: true, maxModuleLevel: 3 });
    expect(recs.recommendations.some((r) => r.unconfirmed)).toBe(false);
    const robot = recs.recommendations.find((r) => r.moduleId === 'MECH70057')!;
    expect(robot.ineligibleReasons).toEqual([
      'MECH70057 Robot dynamics and control is not open to MEng Mechanical Engineering year 3 students. You can choose the programme\'s core modules, its approved electives and I-Explore modules.',
    ]);
  });

  it('the staff module list marks as not offered exactly what the Year 3 rules refuse', async () => {
    const rows = S.StaffModuleSummary.array().parse(await (await app.request('/api/staff/modules')).json());
    expect(rows.length).toBeGreaterThan(0);
    // A Year 3 student who has completed every prerequisite: only the programme rules can refuse a module.
    const prerequisites = [...new Set(catalogue.modules().flatMap((m) => m.prerequisites))];
    const recs = (await recommendations(await sessionFor(3, prerequisites))).recommendations;
    for (const row of rows) {
      const rec = recs.find((r) => r.moduleId === row.moduleId);
      if (!rec) continue; // completed, so not in the student's catalogue
      expect([row.moduleId, row.offer !== 'not-offered']).toEqual([row.moduleId, rec.eligible]);
    }
    expect(rows.find((r) => r.moduleId === 'MECH70057')?.offer).toBe('not-offered');
  });
});
