// Issue #54 and spec 8.6/12: "Answer two more" returns the session to the interview (a traced transition), the
// interviewer asks exactly two questions aimed at unfilled slots, then the "Here is what I heard" card returns and
// confirming it goes back to RECOMMEND. From PLAN the session passes through RECOMMEND first. Offline.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import * as repo from '../src/db/repo.ts';

const app = createApp();
const send = (method: string, b: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const put = async (id: string, b: unknown) => S.SessionState.parse(await (await app.request(`/api/sessions/${id}/profile`, send('PUT', b))).json());
const get = async (id: string) => S.SessionState.parse(await (await app.request(`/api/sessions/${id}`)).json());

async function chat(id: string, content: string) {
  const res = await app.request(`/api/sessions/${id}/messages`, send('POST', { content }));
  return (await res.text())
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))));
}

async function recommendingSession(): Promise<string> {
  const created = await app.request('/api/sessions', send('POST', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
  const { id } = S.SessionState.parse(await created.json());
  expect((await put(id, { confirm: true })).mode).toBe('RECOMMEND');
  return id;
}

const modeEvents = (id: string) => repo.listTraceEvents(id).filter((e) => e.kind === 'mode').map((e) => `${e.input} -> ${e.output}`);

describe('answer two more', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  it('asks two questions about unfilled slots, then shows the card and returns to RECOMMEND', async () => {
    const id = await recommendingSession();
    const resumed = await put(id, { resumeInterview: true });
    expect(resumed.mode).toBe('INTERVIEW');
    expect(resumed.interview.finished).toBe(false);
    expect(modeEvents(id).at(-1)).toBe('RECOMMEND -> INTERVIEW: low confidence and student agrees');
    // The first question is asked straight away, as the newest message, and targets an unfilled slot.
    const first = resumed.messages.at(-1)!;
    expect(first).toMatchObject({ role: 'assistant', agent: 'interviewer' });
    expect(resumed.interview.targetSlots.length).toBeGreaterThan(0);

    // Answering it brings the second question, not the generic RECOMMEND menu.
    const second = await chat(id, 'I lost track of time in the wind tunnel lab and the CFD coursework.');
    const secondText = second.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('');
    expect(secondText).not.toContain('explain a module, change what matters most');
    expect(second.find((e) => e.type === 'done')).toMatchObject({ widget: null });
    expect((await get(id)).interview.questionsAsked).toBe(resumed.interview.questionsAsked + 1);

    // The second answer ends the two-question budget with the "Here is what I heard" card.
    const card = await chat(id, 'I would avoid thermodynamics if I could.');
    expect(card.find((e) => e.type === 'done')).toMatchObject({ widget: { kind: 'confirm-profile' } });
    expect(card.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('')).toContain('Here is what I heard');

    const confirmed = await put(id, { confirm: true });
    expect(confirmed.mode).toBe('RECOMMEND');
    expect(confirmed.profile.interests['fluid-mechanics']).toBeGreaterThan(0.5);
  });

  it('goes through RECOMMEND when the session is in PLAN', async () => {
    const id = await recommendingSession();
    for (const moduleId of ['MECH60009', 'MECH60018']) {
      await app.request(`/api/sessions/${id}/shortlist`, send('POST', { moduleId, action: 'add' }));
    }
    expect((await get(id)).mode).toBe('PLAN');
    const resumed = await put(id, { resumeInterview: true });
    expect(resumed.mode).toBe('INTERVIEW');
    expect(modeEvents(id).slice(-2)).toEqual([
      'PLAN -> RECOMMEND: returning to the interview for two more questions',
      'RECOMMEND -> INTERVIEW: low confidence and student agrees',
    ]);
  });
});
