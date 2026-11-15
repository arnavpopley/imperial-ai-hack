// Issue #67, offline: out-of-scope requests get a redirect naming what the advisor covers and who does help, and
// guarantee questions are told plainly that nothing is promised before the data that does exist.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { QUICK_PLAN } from '../src/agents/interviewer.ts';
import { asksForGuarantee, NO_GUARANTEE } from '../src/agents/outcomes.ts';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { scopeCheck, scopeRedirect } from '../src/guardrails/g1-scope.ts';
import { createTracer } from '../src/trace/tracer.ts';
import * as repo from '../src/db/repo.ts';

const app = createApp();
const send = (method: string, b: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

async function session(confirmed: boolean): Promise<string> {
  const created = await app.request('/api/sessions', send('POST', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
  const { id } = S.SessionState.parse(await created.json());
  if (confirmed) await app.request(`/api/sessions/${id}/profile`, send('PUT', { interests: { 'control-robotics': 0.9 }, confirm: true }));
  return id;
}

async function chat(id: string, content: string) {
  const res = await app.request(`/api/sessions/${id}/messages`, send('POST', { content }));
  const events = (await res.text())
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))));
  return { events, text: events.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('') };
}

describe('asksForGuarantee', () => {
  it('reads questions asking for a job or grade', () => {
    for (const text of ['Will taking Mechatronics 3A get me a job at Boston Dynamics?', 'Will this module get me a first?', 'Is CFD guaranteed to help?', 'Would this land me an internship?']) {
      expect(asksForGuarantee(text), text).toBe(true);
    }
  });

  it('leaves ordinary career questions and remarks alone', () => {
    for (const text of ['Which modules are relevant to a career in robotics?', 'I want a job in robotics after I graduate', 'How is Mechatronics 3A assessed?', 'Add Mechatronics 3A to my shortlist; I know it does not guarantee a job']) {
      expect(asksForGuarantee(text), text).toBe(false);
    }
  });
});

describe('scopeCheck request forms', () => {
  const ctx = { mode: 'RECOMMEND' as const, tracer: createTracer('t', () => {}) };

  it('catches ordinary ways of asking for coursework or an application to be written', async () => {
    for (const text of ['I need help to solve my homework', 'I want you to write my essay on turbulence.', 'Help me with my lab report', 'Could someone draft my personal statement?']) {
      expect((await scopeCheck(text, ctx)).verdict, text).toBe('block');
    }
  });

  it('leaves pasted work and ordinary answers in scope', async () => {
    for (const text of ['Here is my CV: I improved the robotics society application process.', 'I enjoyed writing the CFD coursework report last year.']) {
      expect((await scopeCheck(text, ctx)).verdict, text).toBe('pass');
    }
  });
});

describe('scope and guarantee replies (routes)', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  it('blocks a cover letter request and points to the Careers Service', async () => {
    const id = await session(true);
    const { events, text } = await chat(id, 'Can you write my cover letter for Ocado?');
    expect(events).toContainEqual(expect.objectContaining({ type: 'guardrail', stage: 'G1 scope', verdict: 'block' }));
    expect(text).toBe(scopeRedirect('writing'));
  });

  it('asks the pending interview question again after an essay request', async () => {
    const id = await session(false);
    const { text } = await chat(id, 'Please write my essay on turbulence.');
    expect(text).toBe(`${scopeRedirect('academic-work')}\n\n${QUICK_PLAN[0]!.question}`);
  });

  it('answers a job guarantee question with no promise, then the module data', async () => {
    const id = await session(true);
    const { text } = await chat(id, 'Will taking Mechatronics 3A get me a job at Boston Dynamics?');
    expect(text.startsWith(NO_GUARANTEE)).toBe(true);
    expect(text).toMatch(/Mechatronics 3A is most relevant to these career pathways: .*\d+%/);
    expect(text).toMatch(/Its fit for you is \d+ out of 100\./);
  });

  it('says nothing is promised before the usual answer when no module is named', async () => {
    const id = await session(true);
    const { text } = await chat(id, 'Will any of these get me a first?');
    expect(text.startsWith(NO_GUARANTEE)).toBe(true);
  });

  it('adds a module when the request only mentions guarantees', async () => {
    const id = await session(true);
    await chat(id, 'Add Mechatronics 3A to my shortlist; I know it does not guarantee a job');
    expect(repo.getSession(id)!.shortlist).toContain('MECH60018');
  });

  it('answers an unnamed guarantee question mid-interview and re-asks the question', async () => {
    const id = await session(false);
    const { text } = await chat(id, 'Will any of these get me a first?');
    expect(text.startsWith(NO_GUARANTEE)).toBe(true);
    expect(text).toContain(`Back to the interview: ${QUICK_PLAN[0]!.question}`);
    expect(repo.getSession(id)!.interview.questionsAsked).toBe(1);
  });

  it('keeps the summary card after a guarantee question once the interview has finished', async () => {
    const id = await session(false);
    const { interview } = repo.getSession(id)!;
    repo.updateSession(id, { interview: { ...interview, finished: true } });
    const { events, text } = await chat(id, 'Will Mechatronics 3A get me a job?');
    expect(text.startsWith(NO_GUARANTEE)).toBe(true);
    expect(events.find((e) => e.type === 'done')).toMatchObject({ widget: { kind: 'confirm-profile' } });
  });

  it('answers a guarantee question mid-interview without storing it, then re-asks the question', async () => {
    const id = await session(false);
    const { text } = await chat(id, 'Will Mechatronics 3A get me a job?');
    expect(text.startsWith(NO_GUARANTEE)).toBe(true);
    expect(text).toContain(`Back to the interview: ${QUICK_PLAN[0]!.question}`);
    expect(repo.getSession(id)!.evidence).toEqual([]);
  });
});
