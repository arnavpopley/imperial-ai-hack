// Spec 9.2: overlap, clash probabilities and labels, timetables, swaps and staff clash priorities.
import { DEFAULT_WEIGHTS, type Module, type ProgrammeRules, type Recommendation, type StudentProfile } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { DATASET_FILES, ModulesFile, ProgrammeRulesFile, readDataset, SlotsFile } from '../src/db/datasets.ts';
import {
  buildTimetable,
  checkShortlist,
  clashLabel,
  clashPriorities,
  clashProbability,
  findClashes,
  overlap,
  rankModules,
  suggestSwaps,
  type SwapPlan,
} from '../src/engines/index.ts';
import { makeModule, makeProfile, makeRules, makeSlot } from './engines-fixtures.ts';

describe('overlap', () => {
  const nine = makeSlot('a', 'mon', '09:00', '10:00');

  it('detects a partial overlap on the same term and day', () => {
    expect(overlap(nine, makeSlot('b', 'mon', '09:30', '10:30'))).toBe(true);
  });

  it('treats back-to-back slots, other days and other terms as free', () => {
    expect(overlap(nine, makeSlot('b', 'mon', '10:00', '11:00'))).toBe(false);
    expect(overlap(nine, makeSlot('b', 'tue', '09:00', '10:00'))).toBe(false);
    expect(overlap(nine, makeSlot('b', 'mon', '09:00', '10:00', { term: 'spring' }))).toBe(false);
  });
});

describe('clashProbability', () => {
  const confirmedB = [makeSlot('b', 'mon', '09:00', '10:00')];

  it('is 1 for two confirmed overlapping slots', () => {
    expect(clashProbability([makeSlot('a', 'mon', '09:00', '10:00')], confirmedB)).toBe(1);
  });

  it('is 0.5 when one of two equally likely candidates overlaps', () => {
    const provisionalA = [
      makeSlot('a', 'mon', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('a', 'tue', '09:00', '10:00', { probability: 0.5 }),
    ];
    expect(clashProbability(provisionalA, confirmedB)).toBeCloseTo(0.5);
  });

  it('combines independent session pairs as 1 − Π(1 − P)', () => {
    const twoSessions = [
      makeSlot('a', 'mon', '09:00', '10:00', { probability: 0.5, sessionKey: 'lecture' }),
      makeSlot('a', 'tue', '09:00', '10:00', { probability: 0.5, sessionKey: 'lecture' }),
      makeSlot('a', 'mon', '09:00', '10:00', { probability: 0.5, sessionKey: 'lab', kind: 'lab' }),
      makeSlot('a', 'wed', '09:00', '10:00', { probability: 0.5, sessionKey: 'lab', kind: 'lab' }),
    ];
    expect(clashProbability(twoSessions, confirmedB)).toBeCloseTo(0.75);
  });

  it('treats a sessionKey reused in another term as a separate session', () => {
    const acrossTerms = [
      makeSlot('a', 'mon', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('a', 'tue', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('a', 'mon', '09:00', '10:00', { probability: 0.5, term: 'spring' }),
      makeSlot('a', 'tue', '09:00', '10:00', { probability: 0.5, term: 'spring' }),
    ];
    const bothTerms = [...confirmedB, makeSlot('b', 'mon', '09:00', '10:00', { term: 'spring' })];
    // Two independent 50% clashes: 1 − 0.5 · 0.5 = 0.75, not 0.5 + 0.5.
    expect(clashProbability(acrossTerms, bothTerms)).toBeCloseTo(0.75);
    expect(clashPriorities([['a', 'b']], [...acrossTerms, ...bothTerms])[0]?.probability).toBeCloseTo(0.75);
  });

  it('multiplies candidate probabilities on both sides', () => {
    const provisionalA = [
      makeSlot('a', 'mon', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('a', 'tue', '09:00', '10:00', { probability: 0.5 }),
    ];
    const provisionalB = [
      makeSlot('b', 'mon', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('b', 'thu', '09:00', '10:00', { probability: 0.5 }),
    ];
    expect(clashProbability(provisionalA, provisionalB)).toBeCloseTo(0.25);
  });

  it('is 0 when nothing overlaps', () => {
    expect(clashProbability([makeSlot('a', 'fri', '09:00', '10:00')], confirmedB)).toBe(0);
  });
});

describe('clashLabel', () => {
  it('labels certain, likely and possible clashes', () => {
    expect(clashLabel(1)).toBe('certain');
    expect(clashLabel(1 - 1e-12)).toBe('certain');
    expect(clashLabel(0.999)).toBe('likely');
    expect(clashLabel(0.3)).toBe('likely');
    expect(clashLabel(0.29)).toBe('possible');
  });
});

describe('buildTimetable', () => {
  it('returns one grid per term with slots, in term order, for shortlisted modules only', () => {
    const slots = [
      makeSlot('a', 'tue', '09:00', '10:00', { term: 'spring' }),
      makeSlot('a', 'wed', '11:00', '12:00'),
      makeSlot('b', 'mon', '14:00', '15:00'),
      makeSlot('x', 'mon', '09:00', '10:00', { term: 'summer' }),
    ];
    const grids = buildTimetable(['a', 'b'], slots);
    expect(grids.map((grid) => grid.term)).toEqual(['autumn', 'spring']);
    expect(grids[0]?.slots.map((slot) => slot.day)).toEqual(['mon', 'wed']);
  });
});

describe('findClashes', () => {
  const slots = [
    makeSlot('b', 'mon', '09:00', '10:00'),
    makeSlot('a', 'mon', '09:30', '10:30'),
    makeSlot('a', 'tue', '09:00', '10:00', { term: 'spring' }),
    makeSlot('b', 'tue', '09:00', '10:00', { term: 'spring', probability: 0.4 }),
    makeSlot('b', 'wed', '09:00', '10:00', { term: 'spring', probability: 0.6 }),
    makeSlot('c', 'mon', '10:30', '11:30'),
  ];

  it('gives one clash per module pair per term with the overlapping slot pairs', () => {
    const clashes = findClashes(['b', 'a', 'c'], slots);
    expect(clashes.map(({ moduleA, moduleB, term, label }) => ({ moduleA, moduleB, term, label }))).toEqual([
      { moduleA: 'a', moduleB: 'b', term: 'autumn', label: 'certain' },
      { moduleA: 'a', moduleB: 'b', term: 'spring', label: 'likely' },
    ]);
    expect(clashes[1]?.probability).toBeCloseTo(0.4);
    expect(clashes[0]?.overlaps).toHaveLength(1);
    expect(clashes[0]?.overlaps[0]?.a.moduleId).toBe('a');
  });

  it('labels a low-probability clash as possible', () => {
    const lowSlots = [
      makeSlot('a', 'mon', '09:00', '10:00'),
      makeSlot('b', 'mon', '09:00', '10:00', { probability: 0.2 }),
      makeSlot('b', 'tue', '09:00', '10:00', { probability: 0.8 }),
    ];
    expect(findClashes(['a', 'b'], lowSlots)[0]?.label).toBe('possible');
  });
});

describe('suggestSwaps', () => {
  const rec = (moduleId: string, fit: number, eligible = true): Recommendation => ({
    moduleId,
    fit,
    sub: { interest: 0, goal: null, style: 0, breadth: 0 },
    eligible,
    ineligibleReasons: [],
    confidence: 'high',
  });
  const slots = [
    makeSlot('a', 'mon', '09:00', '10:00'),
    makeSlot('b', 'mon', '09:00', '10:00'),
    makeSlot('c', 'tue', '09:00', '10:00'),
    makeSlot('clashes-with-c', 'tue', '09:30', '10:30'),
  ];
  const shortlist = ['a', 'b', 'c'];
  const [clash] = findClashes(shortlist, slots);
  const ranked = [
    rec('a', 70),
    rec('b', 60),
    rec('c', 65),
    rec('clashes-with-c', 80),
    rec('ineligible', 75, false),
    rec('completed', 59),
    rec('d', 55),
    rec('k', 53),
    rec('i', 52),
    rec('j', 51),
    rec('too-weak', 49),
  ];

  const planFor = (profile: StudentProfile, modules: readonly Module[], rules: Partial<ProgrammeRules> = {}): SwapPlan => {
    const programme = makeRules({ allowedElectiveIds: modules.map((m) => m.id), ...rules });
    return { modules, rules: programme, check: (list) => checkShortlist(list, profile, modules, programme) };
  };
  const electives = ranked.map((r) => makeModule(r.moduleId));

  it('replaces the lower-fit module with eligible, clash-free alternatives within 10 points', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const profile = makeProfile({ completedModuleIds: ['completed'] });
    const swaps = suggestSwaps(profile, shortlist, clash, ranked, slots, planFor(profile, electives));
    expect(swaps).toEqual([
      { replaceModuleId: 'b', withModuleId: 'd', fit: 55, fitDelta: -5 },
      { replaceModuleId: 'b', withModuleId: 'k', fit: 53, fitDelta: -7 },
      { replaceModuleId: 'b', withModuleId: 'i', fit: 52, fitDelta: -8 },
    ]);
  });

  it('considers both modules when their fits are equal', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const tied = [rec('a', 60), rec('b', 60), rec('d', 55)];
    const profile = makeProfile();
    const swaps = suggestSwaps(profile, shortlist, clash, tied, slots, planFor(profile, electives));
    expect(swaps.map((swap) => swap.replaceModuleId)).toEqual(['a', 'b']);
  });

  it('offers only modules of the same kind, never a core module', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const profile = makeProfile({ completedModuleIds: ['completed'] });
    const modules = electives.map((m) =>
      m.id === 'd' ? { ...m, type: 'core' as const, ects: 20 } : m.id === 'k' ? { ...m, type: 'i-explore' as const } : m,
    );
    const swaps = suggestSwaps(profile, shortlist, clash, ranked, slots, planFor(profile, modules, { coreModuleIds: ['d'] }));
    expect(swaps.map((swap) => swap.withModuleId)).toEqual(['i', 'j']);
  });

  it('replaces the elective, not the core module, when a core module is in the clash', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const profile = makeProfile({ completedModuleIds: ['completed'] });
    const withE = [...ranked, rec('e', 66)];
    const plan = planFor(profile, withE.map((r) => makeModule(r.moduleId)), { coreModuleIds: ['b'] });
    expect(suggestSwaps(profile, shortlist, clash, withE, slots, plan)).toEqual([
      { replaceModuleId: 'a', withModuleId: 'e', fit: 66, fitDelta: -4 },
    ]);
  });

  it('rejects alternatives that clash with a core module the student has not shortlisted', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const profile = makeProfile({ completedModuleIds: ['completed'] });
    const withCore = [...slots, makeSlot('core', 'wed', '09:00', '10:00'), makeSlot('d', 'wed', '09:00', '10:00')];
    const modules = [...electives, makeModule('core', { type: 'core' })];
    const swaps = suggestSwaps(profile, shortlist, clash, ranked, withCore, planFor(profile, modules, { coreModuleIds: ['core'] }));
    expect(swaps.map((swap) => swap.withModuleId)).toEqual(['k', 'i', 'j']);
  });

  it('rejects alternatives that add a rules violation or deepen a credit shortfall', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const profile = makeProfile({ completedModuleIds: ['completed'] });
    // d breaks the credit cap, k needs a prerequisite, and i has fewer credits while electives are short.
    const modules = electives.map((m) =>
      m.id === 'd' ? { ...m, ects: 20 } : m.id === 'k' ? { ...m, prerequisites: ['missing'] } : m.id === 'i' ? { ...m, ects: 2.5 } : m,
    );
    const plan = planFor(profile, modules, { maxEcts: 20, electiveEctsRequired: 20 });
    const swaps = suggestSwaps(profile, shortlist, clash, ranked, slots, plan);
    expect(swaps.map((swap) => swap.withModuleId)).toEqual(['j']);
  });
});

describe("suggestSwaps on Rosa's shortlist (seed data)", () => {
  const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
  const { slots } = readDataset(DATASET_FILES.slots, SlotsFile);
  const rules = readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile).rules.find(
    (r) => r.programme === 'MEng Mechanical Engineering' && r.year === 3,
  );
  if (!rules) throw new Error('expected MEng Mechanical Engineering year 3 rules');
  const profile = makeProfile({
    completedModuleIds: ['MECH40002', 'MECH40003', 'MECH40004', 'MECH40005', 'MECH40006', 'MECH40008', 'MECH50001', 'MECH50002', 'MECH50003', 'MECH50004', 'MECH50005', 'MECH50006', 'MECH50008', 'MECH50010'],
    interests: { 'control-robotics': 1, 'electronics-embedded': 0.9, 'design-manufacturing': 0.6 },
    pathways: ['robotics-automation'],
    style: { examPreference: 0.2, groupPreference: 0.4, appliedPreference: 1, mathsComfort: 0.7, codingComfort: 0.6, workloadTolerance: 0.7 },
  });
  const shortlist = ['MECH60009', 'MECH60018', 'MECH60001'];
  const plan: SwapPlan = { modules, rules, check: (list) => checkShortlist(list, profile, modules, rules) };
  const typeOf = (id: string) => modules.find((m) => m.id === id)?.type;

  it('never suggests the core Design, Make and Test Project for the Tuesday 14:00 spring clash', () => {
    const clash = findClashes(shortlist, slots).find((c) => c.term === 'spring' && c.label === 'certain');
    if (!clash) throw new Error('expected a certain spring clash between MECH60009 and MECH60018');
    expect([clash.moduleA, clash.moduleB]).toEqual(['MECH60009', 'MECH60018']);
    // The clashing pair ties and MECH60003 has the best fit of all, so only the kind and rules checks keep it out.
    const ranked = rankModules(profile, modules, DEFAULT_WEIGHTS, rules).map((r) => ({ ...r, fit: r.moduleId === 'MECH60003' ? 60 : 50 }));
    expect(ranked.find((r) => r.moduleId === 'MECH60003')?.eligible).toBe(true);

    const swaps = suggestSwaps(profile, shortlist, clash, ranked, slots, plan);
    expect(swaps.map((swap) => swap.withModuleId)).not.toContain('MECH60003');
    const before = checkShortlist(shortlist, profile, modules, rules).violations.map((v) => v.code);
    for (const swap of swaps) {
      expect(typeOf(swap.withModuleId)).toBe('elective');
      const after = shortlist.map((id) => (id === swap.replaceModuleId ? swap.withModuleId : id));
      expect(checkShortlist(after, profile, modules, rules).violations.map((v) => v.code)).toEqual(before);
    }
  });
});

describe('clashPriorities', () => {
  it('ranks clashing pairs by students × probability', () => {
    const slots = [
      makeSlot('a', 'mon', '09:00', '10:00'),
      makeSlot('b', 'mon', '09:00', '10:00'),
      makeSlot('c', 'mon', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('c', 'thu', '09:00', '10:00', { probability: 0.5 }),
      makeSlot('d', 'fri', '09:00', '10:00'),
    ];
    const shortlists = [['a', 'b'], ['b', 'a'], ['a', 'b', 'b'], ['c', 'b'], ['c', 'd']];
    expect(clashPriorities(shortlists, slots)).toEqual([
      { moduleA: 'a', moduleB: 'b', students: 3, probability: 1, priority: 3 },
      { moduleA: 'b', moduleB: 'c', students: 1, probability: 0.5, priority: 0.5 },
    ]);
  });
});
