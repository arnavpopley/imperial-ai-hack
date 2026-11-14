// Catalogue agent (offline): the deterministic search tool, the new intent rule, and the Supervisor route.
import { schemas, type SessionState } from '@modulematch/shared';
import { fixtureModules } from '@modulematch/shared/fixtures';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { compareModules, filtersFromQuestion, getModule, searchModules, unknownCodes } from '../src/agents/catalogue.ts';
import { classifyByRules } from '../src/agents/intent.ts';
import { catalogue } from '../src/agents/session.ts';
import * as repo from '../src/db/repo.ts';

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const put = (b: unknown) => ({ ...json(b), method: 'PUT' });

async function newSession(): Promise<SessionState> {
  const res = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
  const { id } = schemas.SessionState.parse(await res.json());
  return repo.getSession(id)!;
}

describe('search_modules', () => {
  let session: SessionState;
  const byCode = () => new Map(catalogue.modules().map((m) => [m.code, m]));

  beforeAll(async () => {
    seedIfEmpty();
    session = await newSession();
  });

  it('filters by term', () => {
    const result = searchModules(session, { term: 'spring', limit: 10 });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const r of result.rows) expect(r.terms).toContain('spring');
    const autumnOnly = catalogue.modules().filter((m) => !m.terms.includes('spring')).map((m) => m.code);
    expect(result.rows.some((r) => autumnOnly.includes(r.code))).toBe(false);
  });

  it('filters by type', () => {
    const result = searchModules(session, { type: 'i-explore', limit: 10 });
    expect(result.total).toBeGreaterThan(0);
    for (const r of result.rows) expect(r.type).toBe('i-explore');
  });

  it('filters by exam share', () => {
    const courseworkOnly = searchModules(session, { maxExamShare: 0, limit: 10 });
    expect(courseworkOnly.total).toBeGreaterThan(0);
    for (const r of courseworkOnly.rows) expect(r.examPercent).toBe(0);
    const examOnly = searchModules(session, { minExamShare: 1, limit: 10 });
    expect(examOnly.total).toBeGreaterThan(0);
    for (const r of examOnly.rows) expect(r.examPercent).toBe(100);
  });

  it('filters by topic id or topic word', () => {
    const byId = searchModules(session, { topics: ['sustainability-climate'], limit: 10 });
    expect(byId.rows.map((r) => r.code)).toContain('IEX-CLIMATE');
    const byWord = searchModules(session, { topics: ['climate'], limit: 10 });
    expect(byWord.rows.map((r) => r.code)).toEqual(byId.rows.map((r) => r.code));
    expect(searchModules(session, { topics: ['basket weaving'] }).unknownTopics).toEqual(['basket weaving']);
  });

  it('filters by eligibility and marks ineligible modules', () => {
    const all = searchModules(session, { limit: 10, query: 'nuclear' });
    expect(all.rows.some((r) => !r.eligible && r.ineligibleReasons?.length)).toBe(true);
    const eligible = searchModules(session, { limit: 10, query: 'nuclear', eligibleOnly: true });
    expect(eligible.rows.every((r) => r.eligible)).toBe(true);
    expect(eligible.total).toBeLessThan(all.total);
  });

  it('matches keywords in learning outcomes and returns a snippet', () => {
    const result = searchModules(session, { query: 'python', limit: 10 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.rows[0]!.snippet.toLowerCase()).toContain('python');
    expect(searchModules(session, { query: 'zzzzqq' }).total).toBe(0);
  });

  it('reports fit from the ranking engine and caps the rows', () => {
    const result = searchModules(session, { limit: 3 });
    expect(result.rows).toHaveLength(3);
    const codes = byCode();
    for (const r of result.rows) {
      expect(codes.has(r.code)).toBe(true);
      expect(r.fit).toBeGreaterThanOrEqual(0);
      expect(r.fit).toBeLessThanOrEqual(100);
    }
  });

  it('gets and compares modules, refusing unknown ids', () => {
    expect(getModule(session, 'MECH60006')).toMatchObject({ code: 'MECH60006', student: { eligible: true } });
    expect(getModule(session, 'NOPE1')).toHaveProperty('error');
    const compared = compareModules(session, ['MECH70015', 'Fluid Mechanics 3A']);
    expect('modules' in compared && compared.modules?.map((m) => m.code)).toEqual(['MECH70015', 'MECH60006']);
    expect(compareModules(session, ['MECH70015', 'NOPE1'])).toHaveProperty('error');
  });

  it('reads filters from a question for the offline path', () => {
    expect(filtersFromQuestion('Which modules are coursework-only in spring?')).toEqual({ term: 'spring', maxExamShare: 0 });
    expect(filtersFromQuestion("Anything on climate I'm eligible for?")).toEqual({ topics: ['sustainability-climate'], eligibleOnly: true });
    expect(filtersFromQuestion('Which modules use Python?')).toEqual({ query: 'python' });
  });

  it('spots module codes that are not in the catalogue', () => {
    expect(unknownCodes('Try MECH60006 or MECH99999, or IEX-CLIMATE.')).toEqual(['MECH99999']);
  });
});

describe('catalogue intent rules', () => {
  const intent = (text: string, mode: SessionState['mode'] = 'RECOMMEND') => classifyByRules(text, mode, fixtureModules).intent;

  it.each([
    'Which modules use Python?',
    "What's coursework-only in spring?",
    "Anything on climate I'm eligible for?",
    'Compare CFD and Fluid Mechanics 3A',
    'List the I-Explore modules',
    'Which modules can I take in spring?',
    'Are there any modules with no exams?',
  ])('classifies "%s" as a catalogue question', (text) => {
    expect(intent(text)).toBe('catalogue_question');
  });

  it('keeps the existing intents', () => {
    expect(intent('Can I take Robotics and Control without the prerequisite?')).toBe('rule_exception_request');
    expect(intent('Can I take extra credits this year?')).toBe('rule_exception_request');
    expect(intent('Why is Robotics and Control ranked so high?')).toBe('ask_why');
    expect(intent('Which modules clash on my timetable?')).toBe('timetable_action');
    expect(intent('What if I cared more about my career?')).toBe('what_if');
    expect(intent('Which modules use Python?', 'INTERVIEW')).toBe('answer_interview');
  });
});

describe('catalogue route', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  it('answers a coursework-only question with real spring modules', async () => {
    const { id } = await newSession();
    await app.request(`/api/sessions/${id}/profile`, put({ confirm: true }));
    const stream = await (await app.request(`/api/sessions/${id}/messages`, json({ content: 'Which modules are coursework-only in spring?' }))).text();
    const events = stream
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => schemas.SseEvent.parse(JSON.parse(l.slice(6))));
    const tokens = events.flatMap((e) => (e.type === 'token' ? [e] : []));
    expect(tokens.every((t) => t.agent === 'catalogue')).toBe(true);
    const reply = tokens.map((t) => t.text).join('');
    const modules = new Map(catalogue.modules().map((m) => [m.code, m]));
    const cited = [...modules.keys()].filter((code) => reply.includes(code));
    expect(cited.length).toBeGreaterThan(0);
    for (const code of cited) {
      expect(modules.get(code)!.terms).toContain('spring');
      expect(modules.get(code)!.demand.examShare).toBe(0);
    }
    const trace = repo.listTraceEvents(id);
    expect(trace.some((e) => e.actor === 'catalogue' && e.kind === 'tool' && e.input.startsWith('search_modules'))).toBe(true);
    expect(trace.some((e) => e.actor === 'catalogue' && e.kind === 'agent')).toBe(true);
  });
});
