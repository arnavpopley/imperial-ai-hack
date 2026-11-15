// Issue #56: during the interview, intent comes first. "Skip the rest" ends the interview like the button, a
// question about modules is answered from the catalogue and the pending question is asked again, and neither
// becomes profile evidence or uses up a question. Offline; the live check is `npm run eval:live -- --interview`.
import { schemas as S, type SessionState } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { isModuleQuestion, wantsToFinishInterview } from '../src/agents/intent.ts';
import { QUICK_PLAN } from '../src/agents/interviewer.ts';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { scopeRedirect } from '../src/guardrails/g1-scope.ts';
import * as repo from '../src/db/repo.ts';

const app = createApp();
const send = (method: string, b: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

async function interviewing(): Promise<SessionState> {
  const created = await app.request('/api/sessions', send('POST', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
  return S.SessionState.parse(await created.json());
}

async function chat(id: string, content: string) {
  const res = await app.request(`/api/sessions/${id}/messages`, send('POST', { content }));
  const events = (await res.text())
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))));
  const text = events.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('');
  return { events, text };
}

describe('wantsToFinishInterview', () => {
  it('reads requests to stop', () => {
    for (const text of ['skip the rest, show me my modules', 'skip', 'Can we skip the questions?', 'ok just skip to my modules', 'show me my recommendations', 'Please stop the interview', "let's finish the questions"]) {
      expect(wantsToFinishInterview(text), text).toBe(true);
    }
  });

  it('leaves answers that mention skipping alone', () => {
    for (const text of ['skip this question', "I'd skip the maths-heavy ones", 'skip anything with exams', 'I want to skip exams if possible', 'I love robotics, show me something hands-on', 'Show me the modules with no exams?', 'show me my modules in spring']) {
      expect(wantsToFinishInterview(text), text).toBe(false);
    }
  });
});

describe('isModuleQuestion', () => {
  it('is a question about modules or naming one', () => {
    expect(isModuleQuestion('Which modules use Python?', [])).toBe(true);
    expect(isModuleQuestion('Will taking Mechatronics 3A get me a job at Boston Dynamics?', ['MECH60018'])).toBe(true);
  });

  it('is not an answer, or a question about the interview itself', () => {
    expect(isModuleQuestion('I liked the Mechatronics 3A labs', ['MECH60018'])).toBe(false);
    expect(isModuleQuestion('What do you mean by applied?', [])).toBe(false);
  });
});

describe('interview routing (routes)', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  it('ends the interview on "skip the rest", like the Skip to modules button', async () => {
    const session = await interviewing();
    const { events } = await chat(session.id, 'skip the rest, show me my modules');
    expect(events).toContainEqual({ type: 'mode', mode: 'RECOMMEND', from: 'INTERVIEW' });
    const after = repo.getSession(session.id)!;
    expect(after.mode).toBe('RECOMMEND');
    expect(after.interview.confirmed).toBe(true);
    // recommendations_ready makes the chat show its "See my modules" link.
    expect(events.some((e) => e.type === 'recommendations_ready')).toBe(true);
    // The reply is the stored note, so the rated answer exists.
    const done = events.find((e) => e.type === 'done');
    expect(after.messages.some((m) => done?.type === 'done' && m.id === done.messageId)).toBe(true);
  });

  it('answers a catalogue question from the catalogue, then asks the same question again', async () => {
    const session = await interviewing();
    const { events, text } = await chat(session.id, 'Which modules use Python?');
    expect(events.some((e) => e.type === 'token' && e.agent === 'catalogue')).toBe(true);
    expect(text).toContain(`Back to the interview: ${QUICK_PLAN[0]!.question}`);
    const after = repo.getSession(session.id)!;
    expect(after.evidence).toEqual([]);
    expect(after.interview.questionsAsked).toBe(session.interview.questionsAsked);
    expect(after.interview.askedSteps).toEqual(session.interview.askedSteps);
  });

  it('answers a filtered catalogue question instead of ending the interview', async () => {
    const session = await interviewing();
    const { events, text } = await chat(session.id, 'Show me the modules with no exams?');
    expect(events.some((e) => e.type === 'mode')).toBe(false);
    expect(text).toContain(`Back to the interview: ${QUICK_PLAN[0]!.question}`);
    expect(repo.getSession(session.id)!.mode).toBe('INTERVIEW');
  });

  it('stores no evidence from a question about a module and a job', async () => {
    const session = await interviewing();
    await chat(session.id, 'Will taking Mechatronics 3A get me a job at Boston Dynamics?');
    const after = repo.getSession(session.id)!;
    expect(after.evidence).toEqual([]);
    expect(after.profile.pathways).toEqual([]);
    expect(after.interview.questionsAsked).toBe(session.interview.questionsAsked);
  });

  it('asks the pending question again after an off-topic redirect', async () => {
    const session = await interviewing();
    const { text } = await chat(session.id, 'Can you write my essay for the exam?');
    expect(text).toBe(`${scopeRedirect('academic-work')}\n\n${QUICK_PLAN[0]!.question}`);
    expect(repo.getSession(session.id)!.interview.questionsAsked).toBe(session.interview.questionsAsked);
  });

  it('still sends an answer to the interviewer', async () => {
    const session = await interviewing();
    await chat(session.id, 'I lost track of time in the robotics lab and the control systems coursework.');
    const after = repo.getSession(session.id)!;
    expect(after.evidence.length).toBeGreaterThan(0);
    expect(after.interview.questionsAsked).toBe(session.interview.questionsAsked + 1);
  });
});
