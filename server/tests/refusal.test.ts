// Issue 112: a rule refusal suggests only relevant alternatives (or says there are none), names close modules already
// on the shortlist, reads coherently about exceptions, and stays short.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { alternativesTo, andList, holdTemplate, MIN_ALTERNATIVE_FIT, ruleClauses } from '../src/agents/matcher.ts';
import { makeModule, makeProfile } from './engines-fixtures.ts';

const words = (text: string) => text.trim().split(/\s+/).length;

describe('alternativesTo', () => {
  const target = makeModule('robots', { topics: { 'control-robotics': 0.9, 'mathematics-modelling': 0.3 } });
  const mechatronics = makeModule('mechatronics', { topics: { 'control-robotics': 0.8 } });
  const maths = makeModule('maths', { topics: { 'mathematics-modelling': 0.9 } });
  const control = makeModule('control', { topics: { 'control-robotics': 0.7, 'mathematics-modelling': 0.2 } });
  const intro = makeModule('intro', { topics: { 'fluid-mechanics': 0.9 } });
  const modules = [target, mechatronics, maths, control, intro];
  const rec = (moduleId: string, fit: number, eligible = true) => ({
    moduleId,
    fit,
    sub: { interest: 0, goal: null, style: 0, breadth: 0 },
    eligible,
    ineligibleReasons: [],
    confidence: 'high' as const,
  });

  it('keeps only modules on the same ground with a sensible fit, and names close ones already shortlisted', () => {
    // A shortlisted module is named whatever its fit: the student already chose it.
    const ranked = [rec('robots', 30, false), rec('mechatronics', 12), rec('maths', 24), rec('control', MIN_ALTERNATIVE_FIT), rec('intro', 80)];
    const result = alternativesTo(target, modules, ranked, ['mechatronics']);
    expect(result.open.map((a) => a.moduleId)).toEqual(['control']);
    expect(result.shortlisted).toEqual(['mechatronics']);
  });

  it('drops the fit floor when the profile gives fit no meaning, and puts an open prerequisite first', () => {
    const ranked = [rec('robots', 0, false), rec('mechatronics', 5), rec('intro', 2)];
    const result = alternativesTo(target, modules, ranked, [], { prerequisiteIds: ['intro'], fitSignal: false });
    expect(result.open).toEqual([
      { moduleId: 'intro', fit: 2, prerequisite: true },
      { moduleId: 'mechatronics', fit: 5, prerequisite: false },
    ]);
  });

  it('pads nothing in when nothing qualifies', () => {
    const ranked = [rec('robots', 30, false), rec('maths', 90), rec('intro', 90)];
    expect(alternativesTo(target, modules, ranked, [])).toEqual({ open: [], shortlisted: [] });
  });
});

describe('the refusal wording', () => {
  const nuclear = makeModule('MECH70002', { title: 'Nuclear Reactor Physics', level: 4 });
  const violations = [
    { code: 'NOT_ALLOWED' as const, moduleId: 'MECH70002', message: 'x' },
    { code: 'PREREQUISITE_MISSING' as const, moduleId: 'MECH70002', prerequisiteId: 'MECH60004', message: 'y' },
  ];
  const clauses = ruleClauses(violations, nuclear, 3, () => 'Introduction to Nuclear Energy A');

  it('states the rule as one line of short clauses', () => {
    expect(clauses).toEqual(["it isn't open to Year 3 students on your programme", 'it needs Introduction to Nuclear Energy A first']);
    expect(andList(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('is coherent about exceptions and stays near 50 words', () => {
    const text = holdTemplate({ module: nuclear, clauses, open: [{ title: 'Introduction to Nuclear Energy A', fit: 16, prerequisite: true }], shortlisted: [] });
    expect(text).toContain("I can't approve Nuclear Reactor Physics myself");
    expect(text).toContain("The Senior Tutor can make exceptions, so I've drafted a request below");
    expect(text).not.toMatch(/can.?t make an exception/i);
    expect(text).toContain('Introduction to Nuclear Energy A (its prerequisite)');
    expect(words(text)).toBeLessThanOrEqual(60);
  });

  it('says so when nothing else fits, and names shortlisted modules instead of padding', () => {
    const none = holdTemplate({ module: nuclear, clauses, open: [], shortlisted: [] });
    expect(none).toContain('Nothing else open to you covers this closely.');
    const shortlisted = holdTemplate({ module: nuclear, clauses, open: [], shortlisted: ['Mechatronics 3A'] });
    expect(shortlisted).toContain('Mechatronics 3A, already on your shortlist, covers similar ground.');
    expect(shortlisted).not.toContain('Nothing else');
  });
});

describe('the issue 112 scenarios, offline', () => {
  const app = createApp();
  const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  let id = '';

  beforeAll(async () => {
    seedIfEmpty();
    const created = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    id = S.SessionState.parse(await created.json()).id;
    const profile = makeProfile({ interests: { 'control-robotics': 0.9, 'programming-software': 0.8 } });
    await app.request(`/api/sessions/${id}/profile`, { ...json({ interests: profile.interests, confirm: true }), method: 'PUT' });
    for (const moduleId of ['MECH60009', 'MECH60018', 'MECH60001']) {
      await app.request(`/api/sessions/${id}/shortlist`, json({ moduleId, action: 'add' }));
    }
  });

  const ask = async (content: string) => {
    const stream = await (await app.request(`/api/sessions/${id}/messages`, json({ content }))).text();
    return stream
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))))
      .flatMap((e) => (e.type === 'token' && e.agent === 'matcher' ? [e.text] : []))
      .join('');
  };

  it('Robot dynamics and control: no unrelated maths modules; the close ones are named as already shortlisted', async () => {
    const reply = await ask('Can I take Robot dynamics and control this year?');
    expect(reply).toContain("I can't approve Robot dynamics and control myself");
    expect(reply).not.toMatch(/Mathematics A|Continuum|Finite Element/);
    expect(reply).toMatch(/Mechatronics 3A.*already on your shortlist/);
    expect(words(reply)).toBeLessThanOrEqual(60);
  });

  it('Nuclear Reactor Physics: the prerequisite is suggested, Mathematics A is not', async () => {
    const reply = await ask('Can I take Nuclear Reactor Physics anyway, even without the prerequisite?');
    expect(reply).toContain('Introduction to Nuclear Energy A (its prerequisite)');
    expect(reply).not.toContain('Mathematics A');
    expect(words(reply)).toBeLessThanOrEqual(60);
  });
});
