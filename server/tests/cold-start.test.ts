// Issue #50: a student who skips the interview gets an honest starter order, no fit numbers, no tutor
// escalation and an offer of a few questions. Full profiles rank exactly as before.
import { DEFAULT_WEIGHTS, schemas as S, STARTER_QUESTIONS, type Recommendation } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { explainByRules } from '../src/agents/matcher.ts';
import { QUICK_PLAN } from '../src/agents/interviewer.ts';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import * as repo from '../src/db/repo.ts';
import { hasFitSignal, rankModules, starterOrder } from '../src/engines/index.ts';
import { makeModule, makeProfile, makeRules } from './engines-fixtures.ts';

const app = createApp();
const send = (method: string, b: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

describe('hasFitSignal', () => {
  it('needs an interest or a pathway; style alone or zero interests do not count', () => {
    expect(hasFitSignal(makeProfile())).toBe(false);
    expect(hasFitSignal(makeProfile({ interests: { 'fluid-mechanics': 0 } }))).toBe(false);
    expect(hasFitSignal(makeProfile({ style: { ...makeProfile().style, mathsComfort: 0.8 } }))).toBe(false);
    expect(hasFitSignal(makeProfile({ interests: { 'fluid-mechanics': 0.6 } }))).toBe(true);
    expect(hasFitSignal(makeProfile({ pathways: ['robotics-automation'] }))).toBe(true);
  });
});

describe('starterOrder', () => {
  const modules = [
    makeModule('y4-elective', { level: 4, title: 'A level 4 elective' }),
    makeModule('core', { type: 'core', title: 'A core module' }),
    makeModule('iex', { type: 'i-explore', title: 'An I-Explore' }),
    makeModule('quiet', { title: 'B quiet elective' }),
    makeModule('popular', { title: 'Z popular elective' }),
    makeModule('alpha', { title: 'A quiet elective' }),
  ];
  const recs = rankModules(makeProfile(), modules, DEFAULT_WEIGHTS, makeRules({ allowedElectiveIds: modules.map((m) => m.id) }));

  it('puts the year first, then electives, I-Explore and core, then cohort popularity, then title', () => {
    const order = starterOrder(recs, modules, 3, new Map([['popular', 4], ['quiet', 1]])).map((r: Recommendation) => r.moduleId);
    expect(order).toEqual(['popular', 'quiet', 'alpha', 'iex', 'core', 'y4-elective']);
  });

  it('every module has the same fit with an empty profile, which is why fit cannot order them', () => {
    expect(new Set(recs.map((r) => r.fit)).size).toBe(1);
  });
});

describe('template explanations claim nothing the student did not say', () => {
  const module = makeModule('m', { topics: { 'fluid-mechanics': 1 } });
  const rec = rankModules(makeProfile(), [module], DEFAULT_WEIGHTS, makeRules({ allowedElectiveIds: ['m'] }))[0]!;

  it('has no fit band, no learning preferences and no interest watch-out for an empty profile', () => {
    const explanation = explainByRules(makeProfile(), module, rec, []);
    expect(explanation.summary).not.toMatch(/fit at|learning preferences/);
    expect(explanation.watchOuts.join(' ')).not.toMatch(/interests you described/);
  });

  it('cites learning preferences only when one is set', () => {
    const pathwayOnly = makeProfile({ pathways: ['robotics-automation'] });
    const scored = rankModules(pathwayOnly, [module], DEFAULT_WEIGHTS, makeRules({ allowedElectiveIds: ['m'] }))[0]!;
    expect(explainByRules(pathwayOnly, module, scored, []).summary).not.toMatch(/learning preferences/);
    const withStyle = makeProfile({ pathways: ['robotics-automation'], style: { ...makeProfile().style, examPreference: 0.4 } });
    expect(explainByRules(withStyle, module, scored, []).summary).toMatch(/learning preferences/);
  });
});

describe('skipping the interview (routes)', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  async function skipped(): Promise<string> {
    const created = await app.request('/api/sessions', send('POST', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    const { id } = S.SessionState.parse(await created.json());
    const res = await app.request(`/api/sessions/${id}/profile`, send('PUT', { confirm: true }));
    expect(S.SessionState.parse(await res.json()).mode).toBe('RECOMMEND');
    return id;
  }

  it('returns a starter order: this year first, electives before core, no tutor draft', async () => {
    const id = await skipped();
    const recs = S.RecommendationsResponse.parse(await (await app.request(`/api/sessions/${id}/recommendations`)).json());
    expect(recs.ranking).toBe('starter');
    const byId = new Map(repo.listModules().map((m) => [m.id, m]));
    const first = byId.get(recs.recommendations[0]!.moduleId)!;
    expect(first.level).toBe(3);
    expect(first.type).toBe('elective');
    const session = repo.getSession(id)!;
    expect(session.escalationDraft).toBeNull();
    expect(session.messages.at(-1)?.content).toContain(`Answer ${STARTER_QUESTIONS} quick questions`);
  });

  it('offers the personal tutor only after a full interview that is still low', async () => {
    const created = await app.request('/api/sessions', send('POST', { programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    const { id, interview } = S.SessionState.parse(await created.json());
    repo.updateSession(id, { interview: { ...interview, finished: true } });
    await app.request(`/api/sessions/${id}/profile`, send('PUT', { confirm: true }));
    expect(repo.getSession(id)?.escalationDraft?.type).toBe('LOW_CONFIDENCE');
  });

  it('reopens the interview with the skipped question and STARTER_QUESTIONS more', async () => {
    const id = await skipped();
    const before = repo.getSession(id)!;
    const res = await app.request(`/api/sessions/${id}/profile`, send('PUT', { resumeInterview: true }));
    const after = S.SessionState.parse(await res.json());
    expect(after.mode).toBe('INTERVIEW');
    expect(after.interview.budget).toBe(before.interview.questionsAsked + STARTER_QUESTIONS);
    expect(after.messages.at(-1)?.content).toContain(QUICK_PLAN[0]!.question);
    expect(after.interview.askedSteps).toEqual([QUICK_PLAN[0]!.id]);
  });

  it('ranks by fit once the student has an interest', async () => {
    const id = await skipped();
    await app.request(`/api/sessions/${id}/profile`, send('PUT', { interests: { 'control-robotics': 1 } }));
    const recs = S.RecommendationsResponse.parse(await (await app.request(`/api/sessions/${id}/recommendations`)).json());
    expect(recs.ranking).toBe('fit');
  });
});
