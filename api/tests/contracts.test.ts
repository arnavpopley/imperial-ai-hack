// WS0 contract tests: fixtures match their schemas and every spec-13 route returns a valid fixture.
import { schemas } from '@modulematch/shared';
import * as fx from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/app.ts';

const app = createApp();
const S = schemas;

const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const put = (b: unknown) => ({ ...json(b), method: 'PUT' });

describe('fixtures match schemas', () => {
  const cases: [string, z.ZodType, unknown][] = [
    ['modules', S.Module.array(), fx.fixtureModules],
    ['session', S.SessionState, fx.fixtureSession],
    ['recommendations', S.RecommendationsResponse, fx.fixtureRecommendations],
    ['explanation', S.Explanation, fx.fixtureExplanation],
    ['timetable', S.TimetableView, fx.fixtureTimetable],
    ['pathways', S.Pathway.array(), fx.fixturePathways],
    ['pathway progress', S.PathwayProgress, fx.fixturePathwayProgress],
    ['societies', S.Society.array(), fx.fixtureSocieties],
    ['society matches', S.SocietyMatch.array(), fx.fixtureSocietyMatches],
    ['staff modules', S.StaffModuleSummary.array(), fx.fixtureStaffModules],
    ['insights', S.Insight.array(), fx.fixtureInsights],
    ['clash priorities', S.ClashPriority.array(), fx.fixtureClashPriorities],
    ['staff escalations', S.StaffEscalation.array(), fx.fixtureStaffEscalations],
    ['trace', S.TraceEvent.array(), fx.fixtureTrace],
    ['eval', S.EvalRun, fx.fixtureEvalRun],
  ];
  it.each(cases)('%s', (_name, schema, value) => {
    expect(() => schema.parse(value)).not.toThrow();
  });
});

describe('every route returns a valid response', () => {
  const sid = fx.fixtureSession.id;
  const routes: [string, RequestInit | undefined, z.ZodType][] = [
    ['/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }), S.SessionState],
    [`/api/sessions/${sid}`, undefined, S.SessionState],
    [`/api/sessions/${sid}/profile`, put({ breadthAppetite: 0.4 }), S.SessionState],
    [`/api/sessions/${sid}/profile`, { method: 'DELETE' }, S.SessionState],
    [`/api/sessions/${sid}/weights`, put({ interest: 1, goal: 0, style: 0, breadth: 0 }), S.RecommendationsResponse],
    [`/api/sessions/${sid}/recommendations`, undefined, S.RecommendationsResponse],
    [`/api/sessions/${sid}/modules/ME3-CFD/explanation`, undefined, S.ExplanationResponse],
    [`/api/sessions/${sid}/shortlist`, json({ moduleId: 'ME3-CFD', action: 'add' }), S.SessionState],
    [`/api/sessions/${sid}/timetable`, undefined, S.TimetableView],
    [`/api/sessions/${sid}/escalations`, json({ type: 'RULE_EXCEPTION', summary: 'x' }), S.Escalation],
    [`/api/sessions/${sid}/pathways/aerospace-motorsport/progress`, undefined, S.PathwayProgress],
    [`/api/sessions/${sid}/societies`, undefined, S.SocietyMatch.array()],
    ['/api/staff/modules', undefined, S.StaffModuleSummary.array()],
    ['/api/staff/modules/ME3-ROB/insights', undefined, S.Insight.array()],
    ['/api/staff/insights/ins-1/decision', json({ decision: 'accepted' }), S.Insight],
    ['/api/staff/modules/ME3-CFD/derived', put({ topics: { 'fluid-mechanics': 1 } }), S.Module],
    ['/api/staff/timetable/clash-priorities', undefined, S.ClashPriority.array()],
    ['/api/staff/escalations', undefined, S.StaffEscalation.array()],
    ['/api/staff/escalations/esc-1/respond', json({ response: 'Approved.' }), S.Escalation],
    ['/api/modules', undefined, S.Module.array()],
    ['/api/pathways', undefined, S.Pathway.array()],
    ['/api/societies', undefined, S.Society.array()],
    [`/api/trace/${sid}`, undefined, S.TraceEvent.array()],
    ['/api/eval/latest', undefined, S.EvalRun],
  ];
  it.each(routes)('%s', async (path, init, schema) => {
    const res = await app.request(path, init);
    expect(res.ok).toBe(true);
    const payload: unknown = await res.json();
    expect(() => schema.parse(payload)).not.toThrow();
  });

  it('rejects an invalid body with 400', async () => {
    const res = await app.request(`/api/sessions/${sid}/shortlist`, json({ moduleId: 'x', action: 'steal' }));
    expect(res.status).toBe(400);
  });

  it('streams valid SSE events from /messages', async () => {
    const res = await app.request(`/api/sessions/${sid}/messages`, json({ content: 'hello' }));
    const text = await res.text();
    const events = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))));
    expect(events.at(-1)?.type).toBe('done');
  });
});
