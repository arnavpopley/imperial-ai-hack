// Contract tests: fixtures match their schemas, and every spec-13 route returns a schema-valid response.
import { schemas } from '@modulematch/shared';
import * as fx from '@modulematch/shared/fixtures';
import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';

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

describe('fixture swaps', () => {
  it('only suggest eligible modules', () => {
    const eligible = new Set(fx.fixtureRecommendations.recommendations.filter((r) => r.eligible).map((r) => r.moduleId));
    for (const swap of fx.fixtureTimetable.swaps) expect(eligible.has(swap.withModuleId)).toBe(true);
  });
});

// Every spec-13 route against the seeded in-memory database, validated with the shared schemas.
describe('every route returns a valid response', () => {
  let sid = '';
  let escalationId = '';
  const ids = { module: 'MECH60006', insightModule: 'MECH60009', pathway: 'aerospace-motorsport' };

  beforeAll(async () => {
    seedIfEmpty();
    const res = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    sid = S.SessionState.parse(await res.json()).id;
  });

  const check = async (path: string, init: RequestInit | undefined, schema: z.ZodType) => {
    const res = await app.request(path, init);
    expect(res.ok).toBe(true);
    const payload: unknown = await res.json();
    expect(() => schema.parse(payload)).not.toThrow();
    return payload;
  };

  it('student routes', async () => {
    const s = `/api/sessions/${sid}`;
    await check(s, undefined, S.SessionState);
    await check(`${s}/profile`, put({ breadthAppetite: 0.4 }), S.SessionState);
    await check(`${s}/weights`, put({ interest: 1, goal: 0, style: 0, breadth: 0 }), S.RecommendationsResponse);
    await check(`${s}/recommendations`, undefined, S.RecommendationsResponse);
    await check(`${s}/modules/${ids.module}/explanation`, undefined, S.ExplanationResponse);
    await check(`${s}/shortlist`, json({ moduleId: ids.module, action: 'add' }), S.SessionState);
    await check(`${s}/timetable`, undefined, S.TimetableView);
    const escalation = (await check(`${s}/escalations`, json({ type: 'RULE_EXCEPTION', summary: 'x' }), S.Escalation)) as { id: string };
    escalationId = escalation.id;
    await check(`${s}/pathways/${ids.pathway}/progress`, undefined, S.PathwayProgress);
    await check(`${s}/societies`, undefined, S.SocietyMatch.array());
    await check(`${s}/profile`, { method: 'DELETE' }, S.SessionState);
  });

  it('staff routes', async () => {
    await check('/api/staff/modules', undefined, S.StaffModuleSummary.array());
    const insights = (await check(`/api/staff/modules/${ids.insightModule}/insights`, undefined, S.Insight.array())) as { id: string }[];
    expect(insights.length).toBeGreaterThan(0);
    await check(`/api/staff/insights/${insights[0]!.id}/decision`, json({ decision: 'accepted' }), S.Insight);
    await check(`/api/staff/modules/${ids.module}/derived`, put({ topics: { 'fluid-mechanics': 1 } }), S.Module);
    await check('/api/staff/timetable/clash-priorities', undefined, S.ClashPriority.array());
    await check('/api/staff/escalations', undefined, S.StaffEscalation.array());
    await check(`/api/staff/escalations/${escalationId}/respond`, json({ response: 'Approved.' }), S.Escalation);
  });

  it('shared routes', async () => {
    await check('/api/modules', undefined, S.Module.array());
    await check('/api/pathways', undefined, S.Pathway.array());
    await check('/api/societies', undefined, S.Society.array());
    await check(`/api/trace/${sid}`, undefined, S.TraceEvent.array());
    await check('/api/eval/latest', undefined, S.EvalRun.nullable());
  });

  it('refuses to shortlist an ineligible module, as the chat does', async () => {
    const res = await app.request(`/api/sessions/${sid}/shortlist`, json({ moduleId: 'MECH70002', action: 'add' }));
    expect(res.status).toBe(422);
  });

  it('answers a why question about a completed module without failing', async () => {
    const created = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    const id = S.SessionState.parse(await created.json()).id;
    await app.request(`/api/sessions/${id}/profile`, put({ confirm: true }));
    const stream = await (await app.request(`/api/sessions/${id}/messages`, json({ content: 'Why is Fluid Mechanics 1 scored like that?' }))).text();
    const reply = stream
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))))
      .flatMap((e) => (e.type === 'token' ? [e.text] : []))
      .join('');
    expect(reply).toContain('already completed');
    const after = S.SessionState.parse(await (await app.request(`/api/sessions/${id}`)).json());
    expect(after.mode).toBe('RECOMMEND');
  });

  it('rejects an invalid body with 400 and an unknown session with 404', async () => {
    expect((await app.request(`/api/sessions/${sid}/shortlist`, json({ moduleId: 'x', action: 'steal' }))).status).toBe(400);
    expect((await app.request('/api/sessions/nope')).status).toBe(404);
  });

  it('streams valid SSE events from /messages', async () => {
    const created = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    const fresh = S.SessionState.parse(await created.json()).id;
    const res = await app.request(`/api/sessions/${fresh}/messages`, json({ content: 'I love fluid mechanics and robotics.' }));
    const events = (await res.text())
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))));
    expect(events.map((e) => e.type)).toContain('profile_update');
    expect(events.at(-1)?.type).toBe('done');
  });
});
