// Spec 8.8 required tests: boundary values, null style dimensions, empty pathways, weight renormalisation, determinism.
import { combineFit, DEFAULT_WEIGHTS } from '@modulematch/shared';
import type { Evidence } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import {
  breadth,
  completeness,
  goalAlignment,
  interestAlignment,
  NEUTRAL_STYLE_FIT,
  profileHash,
  rankModules,
  scoreModule,
  styleFit,
} from '../src/engines/index.ts';
import { makeModule, makeProfile, makeRules } from './engines-fixtures.ts';

const nullStyle = makeProfile().style;
const allStyle = (value: number) => ({
  examPreference: value,
  groupPreference: value,
  appliedPreference: value,
  mathsComfort: value,
  codingComfort: value,
  workloadTolerance: value,
});
const allDemand = (value: number) => ({
  examShare: value,
  groupShare: value,
  applied: value,
  mathsIntensity: value,
  codingIntensity: value,
  workload: value,
});

describe('interestAlignment (8.1)', () => {
  it('is the topic-weighted mean of interest strengths', () => {
    const interests = { 'fluid-mechanics': 1, 'thermodynamics-energy': 0.5 };
    const topics = { 'fluid-mechanics': 0.6, 'thermodynamics-energy': 0.4 };
    expect(interestAlignment(interests, topics)).toBeCloseTo(0.8);
  });

  it('returns 0, not NaN, for a module with no topics', () => {
    expect(interestAlignment({ 'fluid-mechanics': 1 }, {})).toBe(0);
  });
});

describe('goalAlignment (8.2)', () => {
  it('takes the best relevance across chosen pathways', () => {
    expect(goalAlignment(['energy', 'aero'], { energy: 0.3, aero: 0.9 })).toBe(0.9);
  });

  it('is null when no pathway is chosen', () => {
    expect(goalAlignment([], { energy: 0.3 })).toBeNull();
  });
});

describe('styleFit (8.3)', () => {
  it('skips null dimensions so K shrinks', () => {
    const style = { ...nullStyle, examPreference: 0.2 };
    expect(styleFit(style, { ...allDemand(0.5), examShare: 0.6 })).toBeCloseTo(0.6);
    // A second dimension with no penalty halves the mean penalty: 1 − 0.4 / 2.
    expect(styleFit({ ...style, mathsComfort: 0.9 }, { ...allDemand(0.5), examShare: 0.6 })).toBeCloseTo(0.8);
  });

  it('is neutral when every style dimension is null', () => {
    expect(styleFit(nullStyle, allDemand(1))).toBe(NEUTRAL_STYLE_FIT);
  });

  it('penalises capability only when demand exceeds comfort', () => {
    const demand = allDemand(0.5);
    expect(styleFit({ ...nullStyle, mathsComfort: 0.8 }, { ...demand, mathsIntensity: 0.3 })).toBe(1);
    expect(styleFit({ ...nullStyle, mathsComfort: 0.3 }, { ...demand, mathsIntensity: 0.8 })).toBeCloseTo(0.5);
    expect(styleFit({ ...nullStyle, codingComfort: 1 }, { ...demand, codingIntensity: 0 })).toBe(1);
    expect(styleFit({ ...nullStyle, workloadTolerance: 0 }, { ...demand, workload: 1 })).toBe(0);
  });

  it('penalises preference dimensions symmetrically', () => {
    const demand = allDemand(0.5);
    expect(styleFit({ ...nullStyle, examPreference: 0.8 }, { ...demand, examShare: 0.3 })).toBeCloseTo(0.5);
    expect(styleFit({ ...nullStyle, examPreference: 0.3 }, { ...demand, examShare: 0.8 })).toBeCloseTo(0.5);
  });
});

describe('breadth (8.4)', () => {
  it('scales the out-of-programme share by the appetite', () => {
    const topics = { 'fluid-mechanics': 0.5, 'policy-ethics': 0.5 };
    expect(breadth(0.5, { 'fluid-mechanics': 1 }, topics)).toBeCloseTo(0.25);
  });

  it('gives no credit for an unknown appetite or a module with no topics', () => {
    expect(breadth(null, {}, { 'policy-ethics': 1 })).toBe(0);
    expect(breadth(1, {}, {})).toBe(0);
  });
});

describe('scoreModule (8.5)', () => {
  it('scores 100 when every input is 1', () => {
    const profile = makeProfile({
      interests: { 'fluid-mechanics': 1 },
      pathways: ['aero'],
      style: allStyle(1),
      breadthAppetite: 1,
    });
    const module = makeModule('m', { topics: { 'fluid-mechanics': 1 }, pathwayRelevance: { aero: 1 }, demand: allDemand(1) });
    const rec = scoreModule(profile, module, DEFAULT_WEIGHTS, {});
    expect(rec.sub).toEqual({ interest: 1, goal: 1, style: 1, breadth: 1 });
    expect(rec.fit).toBe(100);
  });

  it('scores 0 when every input is 0 and the module demands everything', () => {
    const profile = makeProfile({
      interests: { 'fluid-mechanics': 0 },
      pathways: ['aero'],
      style: allStyle(0),
      breadthAppetite: 0,
    });
    const module = makeModule('m', { topics: { 'fluid-mechanics': 1 }, pathwayRelevance: { aero: 0 }, demand: allDemand(1) });
    const rec = scoreModule(profile, module, DEFAULT_WEIGHTS, {});
    expect(rec.sub).toEqual({ interest: 0, goal: 0, style: 0, breadth: 0 });
    expect(rec.fit).toBe(0);
  });

  it('drops the goal weight when pathways are empty', () => {
    const module = makeModule('m', { topics: { 'fluid-mechanics': 1 }, pathwayRelevance: { aero: 1 } });
    const interests = { 'fluid-mechanics': 0.8 };
    const withoutGoal = scoreModule(makeProfile({ interests }), module, DEFAULT_WEIGHTS, {});
    // (0.45·0.8 + 0.2·0.5) / 0.75 = 0.6133
    expect(withoutGoal.sub.goal).toBeNull();
    expect(withoutGoal.fit).toBe(61);
    // (0.45·0.8 + 0.25·1 + 0.2·0.5) / 1 = 0.71
    expect(scoreModule(makeProfile({ interests, pathways: ['aero'] }), module, DEFAULT_WEIGHTS, {}).fit).toBe(71);
  });

  it('renormalises the weights and uses combineFit', () => {
    const profile = makeProfile({ interests: { 'fluid-mechanics': 0.8 }, style: allStyle(0.5), breadthAppetite: 0.4 });
    const module = makeModule('m', { topics: { 'fluid-mechanics': 1 } });
    const base = scoreModule(profile, module, DEFAULT_WEIGHTS, {});
    const doubled = { interest: 0.9, goal: 0.5, style: 0.4, breadth: 0.2 };
    expect(scoreModule(profile, module, doubled, {}).fit).toBe(base.fit);
    expect(scoreModule(profile, module, { interest: 1, goal: 0, style: 0, breadth: 0 }, {}).fit).toBe(80);
    expect(base.fit).toBe(combineFit(base.sub, DEFAULT_WEIGHTS));
  });

  it('labels confidence from profile completeness', () => {
    const module = makeModule('m');
    expect(scoreModule(makeProfile({ completeness: 0.9 }), module, DEFAULT_WEIGHTS, {}).confidence).toBe('high');
    expect(scoreModule(makeProfile({ completeness: 0.6 }), module, DEFAULT_WEIGHTS, {}).confidence).toBe('medium');
    expect(scoreModule(makeProfile({ completeness: 0.4 }), module, DEFAULT_WEIGHTS, {}).confidence).toBe('low');
  });
});

describe('rankModules (8.7)', () => {
  const profile = makeProfile({ interests: { 'fluid-mechanics': 1, 'control-robotics': 0.5 } });
  const modules = [
    makeModule('fluids', { topics: { 'fluid-mechanics': 1 } }),
    makeModule('robots', { topics: { 'control-robotics': 1 } }),
    makeModule('advanced', { topics: { 'fluid-mechanics': 1 }, prerequisites: ['fluids'] }),
    makeModule('policy', { topics: { 'policy-ethics': 1 } }),
    makeModule('other', { topics: { 'fluid-mechanics': 1 } }),
  ];
  const rules = makeRules({ allowedElectiveIds: ['fluids', 'robots', 'advanced', 'policy'] });

  it('sorts by fit, breaks ties by id, and keeps ineligible modules with reasons', () => {
    const ranked = rankModules(profile, modules, DEFAULT_WEIGHTS, rules);
    expect(ranked.map((r) => r.moduleId)).toEqual(['advanced', 'fluids', 'other', 'robots', 'policy']);
    const advanced = ranked.find((r) => r.moduleId === 'advanced');
    expect(advanced?.eligible).toBe(false);
    expect(advanced?.ineligibleReasons.join(' ')).toContain('fluids');
    expect(ranked.find((r) => r.moduleId === 'other')?.eligible).toBe(false);
    expect(ranked.find((r) => r.moduleId === 'fluids')).toMatchObject({ eligible: true, ineligibleReasons: [] });
  });

  it('is deterministic, including under a shuffled module order', () => {
    const first = rankModules(profile, modules, DEFAULT_WEIGHTS, rules);
    expect(rankModules(profile, modules, DEFAULT_WEIGHTS, rules)).toEqual(first);
    const shuffled = [modules[3], modules[0], modules[4], modules[2], modules[1]].filter((m) => m !== undefined);
    expect(rankModules(profile, shuffled, DEFAULT_WEIGHTS, rules)).toEqual(first);
  });
});

describe('completeness (8.6)', () => {
  const item = (slot: string, value: Evidence['value'], i = 0): Evidence => ({
    id: `e${i}`,
    sessionId: 's',
    turnId: 't',
    slot,
    value,
    quote: 'quote',
    confidence: 0.9,
  });
  const evidence = (slots: string[]): Evidence[] => slots.map((slot, i) => item(slot, 0.5, i));
  const styleSlots = [
    'style.examPreference',
    'style.groupPreference',
    'style.appliedPreference',
    'style.mathsComfort',
    'style.codingComfort',
    'style.workloadTolerance',
  ];

  it('needs at least three distinct interest topics for the interest slot', () => {
    const two = ['interest:fluid-mechanics', 'interest:fluid-mechanics', 'interest:policy-ethics'];
    expect(completeness(makeProfile(), evidence(two))).toBe(0);
    expect(completeness(makeProfile(), evidence([...two, 'interest:languages']))).toBeCloseTo(1 / 9);
  });

  it('counts the nine required slots, with a pathway choice or an explicit skip', () => {
    const interests = ['interest:fluid-mechanics', 'interest:policy-ethics', 'interest:languages'];
    const filled = [...interests, ...styleSlots, 'breadthAppetite'];
    expect(completeness(makeProfile(), evidence(filled))).toBeCloseTo(8 / 9);
    const chosen = makeProfile({ pathways: ['aerospace-motorsport'] });
    expect(completeness(chosen, [...evidence(filled), item('pathways', ['aerospace-motorsport'])])).toBe(1);
    expect(completeness(makeProfile({ pathwaysSkipped: true }), evidence(filled))).toBe(1);
  });

  it('does not count an empty pathway list or a false skip as a pathway answer', () => {
    const interests = ['interest:fluid-mechanics', 'interest:policy-ethics', 'interest:languages'];
    const filled = evidence([...interests, ...styleSlots, 'breadthAppetite']);
    expect(completeness(makeProfile(), [...filled, item('pathways', [])])).toBeCloseTo(8 / 9);
    expect(completeness(makeProfile(), [...filled, item('pathwaysSkipped', false)])).toBeCloseTo(8 / 9);
  });

  it('needs evidence behind a current pathway choice', () => {
    const interests = ['interest:fluid-mechanics', 'interest:policy-ethics', 'interest:languages'];
    const filled = evidence([...interests, ...styleSlots, 'breadthAppetite']);
    expect(completeness(makeProfile({ pathways: ['aerospace-motorsport'] }), filled)).toBeCloseTo(8 / 9);
    // Evidence of an earlier choice the student has since cleared.
    expect(completeness(makeProfile(), [...filled, item('pathways', ['aerospace-motorsport'])])).toBeCloseTo(8 / 9);
  });

  it('ignores slots outside the whitelist', () => {
    const slots = ['interest:fluid-mechanics', 'interest:policy-ethics', 'interest:not-a-topic', 'style.mood'];
    expect(completeness(makeProfile(), evidence(slots))).toBe(0);
  });
});

describe('profileHash', () => {
  const profile = makeProfile({ interests: { 'fluid-mechanics': 1, 'policy-ethics': 0.2 } });

  it('ignores key order and updatedAt', () => {
    const reordered = makeProfile({
      interests: { 'policy-ethics': 0.2, 'fluid-mechanics': 1 },
      updatedAt: '2026-11-15T09:00:00.000Z',
    });
    expect(profileHash(reordered, DEFAULT_WEIGHTS)).toBe(profileHash(profile, DEFAULT_WEIGHTS));
    expect(profileHash(profile, DEFAULT_WEIGHTS)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes when the profile or the weights change', () => {
    const hash = profileHash(profile, DEFAULT_WEIGHTS);
    expect(profileHash(profile, { ...DEFAULT_WEIGHTS, interest: 0.5 })).not.toBe(hash);
    expect(profileHash({ ...profile, breadthAppetite: 0.3 }, DEFAULT_WEIGHTS)).not.toBe(hash);
  });
});
