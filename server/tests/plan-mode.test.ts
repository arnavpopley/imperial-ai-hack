// Spec 12 through the routes: the shortlist POST moves RECOMMEND to PLAN and back, GET /timetable changes
// nothing, a swap leaves one PLAN transition in the trace rather than flapping, and the chat follows the
// same rule as the buttons.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { applyShortlistEdit, tracerSink } from '../src/agents/session.ts';
import * as repo from '../src/db/repo.ts';
import { createTracer } from '../src/trace/tracer.ts';

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

/** Sends one chat turn and returns its SSE events. */
async function chat(id: string, content: string) {
  const res = await app.request(`/api/sessions/${id}/messages`, send('POST', { content }));
  return (await res.text())
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))));
}

/** The shortlist edits and mode changes in the trace, which the chat and button paths must share. */
const shortlistTrace = (id: string) =>
  repo
    .listTraceEvents(id)
    .filter((e) => e.kind === 'mode' || (e.kind === 'tool' && e.input.startsWith('shortlist ')))
    .map((e) => `${e.kind} ${e.input} -> ${e.output}`);

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

  it('gives a chat shortlist edit the same mode and trace as the button path', async () => {
    const viaButtons = await recommendingSession();
    await shortlist(viaButtons, 'MECH60009', 'add');
    await shortlist(viaButtons, 'MECH60018', 'add');

    const viaChat = await recommendingSession();
    const events = await chat(viaChat, 'Please add MECH60009 and MECH60018 to my shortlist.');
    expect(events).toContainEqual({ type: 'mode', mode: 'PLAN', from: 'RECOMMEND' });
    expect(repo.getSession(viaChat)?.mode).toBe('PLAN');
    expect(shortlistTrace(viaChat)).toEqual(shortlistTrace(viaButtons));

    await shortlist(viaButtons, 'MECH60018', 'remove');
    await chat(viaChat, 'Remove MECH60018 from my shortlist.');
    expect(repo.getSession(viaChat)?.mode).toBe('RECOMMEND');
    expect(shortlistTrace(viaChat)).toEqual(shortlistTrace(viaButtons));
  });

  it('stays in PLAN after the chat explains the timetable', async () => {
    const id = await recommendingSession();
    await shortlist(id, 'MECH60009', 'add');
    await shortlist(id, 'MECH60001', 'add');
    const before = modeEvents(id);

    const events = await chat(id, 'Check my timetable for clashes.');
    expect(events.filter((e) => e.type === 'mode')).toEqual([]);
    expect(repo.getSession(id)?.mode).toBe('PLAN');
    expect(modeEvents(id)).toEqual(before);
  });

  it('reads the saved mode first, so a stale chat copy cannot overwrite ESCALATED with PLAN', async () => {
    const id = await recommendingSession();
    await shortlist(id, 'MECH60009', 'add');
    const stale = repo.getSession(id);
    if (!stale) throw new Error('expected the session');
    // The student approves an escalation in another tab while a chat turn still holds the RECOMMEND copy.
    repo.updateSession(id, { mode: 'ESCALATED' });

    expect(applyShortlistEdit(stale, 'MECH60018', 'add', createTracer(id, tracerSink))).toBeNull();
    expect(repo.getSession(id)?.mode).toBe('ESCALATED');
    expect(repo.getSession(id)?.shortlist).toEqual(['MECH60009', 'MECH60018']);
  });
});
