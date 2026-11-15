// Spec 12 through the routes: the shortlist POST moves RECOMMEND to PLAN and back, GET /timetable changes
// nothing, and a swap leaves one PLAN transition in the trace rather than flapping.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import * as repo from '../src/db/repo.ts';

const app = createApp();
const send = (method: string, b: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

async function recommendingSession(): Promise<string> {
  const created = await app.request('/api/sessions', send('POST', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
  const { id } = S.SessionState.parse(await created.json());
  const confirmed = await app.request(`/api/sessions/${id}/profile`, send('PUT', { confirm: true }));
  expect(S.SessionState.parse(await confirmed.json()).mode).toBe('RECOMMEND');
  return id;
}

async function shortlist(id: string, moduleId: string, action: 'add' | 'remove') {
  const res = await app.request(`/api/sessions/${id}/shortlist`, send('POST', { moduleId, action }));
  expect(res.status).toBe(200);
  return S.SessionState.parse(await res.json());
}

const modeEvents = (id: string) => repo.listTraceEvents(id).filter((e) => e.kind === 'mode').map((e) => `${e.input} -> ${e.output}`);

describe('plan mode follows the shortlist', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  it('enters PLAN when the second module is shortlisted, in the response the client reads', async () => {
    const id = await recommendingSession();
    expect((await shortlist(id, 'MECH60009', 'add')).mode).toBe('RECOMMEND');
    expect((await shortlist(id, 'MECH60018', 'add')).mode).toBe('PLAN');
  });

  it('keeps GET /timetable free of side effects', async () => {
    const id = await recommendingSession();
    await shortlist(id, 'MECH60009', 'add');
    const before = repo.listTraceEvents(id).length;
    const res = await app.request(`/api/sessions/${id}/timetable`);
    expect(res.status).toBe(200);
    expect(repo.getSession(id)?.mode).toBe('RECOMMEND');
    expect(repo.listTraceEvents(id)).toHaveLength(before);
  });

  it('records each transition once: a swap stays in PLAN, and dropping below two returns to RECOMMEND', async () => {
    const id = await recommendingSession();
    await shortlist(id, 'MECH60009', 'add');
    await shortlist(id, 'MECH60018', 'add');
    await app.request(`/api/sessions/${id}/timetable`);
    // A swap as the timetable screen applies it: add the alternative, then remove the module it replaces.
    expect((await shortlist(id, 'MECH60001', 'add')).mode).toBe('PLAN');
    expect((await shortlist(id, 'MECH60018', 'remove')).mode).toBe('PLAN');
    expect((await shortlist(id, 'MECH60001', 'remove')).mode).toBe('RECOMMEND');
    expect(modeEvents(id)).toEqual([
      'ONBOARD -> INTERVIEW: programme and year entered',
      'INTERVIEW -> RECOMMEND: profile confirmed or interview skipped',
      'RECOMMEND -> PLAN: shortlist has two or more modules',
      'PLAN -> RECOMMEND: shortlist edited',
    ]);
  });
});
