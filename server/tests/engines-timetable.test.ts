// Spec 9.2: overlap, clash probabilities and labels, timetables with core modules, kept-free time, swaps and staff
// clash priorities.
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
  keepFreeConflicts,
  keepFreeWindows,
  overlap,
  planTimetable,
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

  it('checks the shortlist against core modules, but never pairs two core modules', () => {
    const withCore = [
      ...slots,
      makeSlot('core-1', 'mon', '09:00', '10:00'),
      makeSlot('core-2', 'mon', '09:00', '10:00'),
    ];
    const pairsOf = findClashes(['c', 'a'], withCore, ['core-1', 'core-2']).map(({ moduleA, moduleB }) => [moduleA, moduleB]);
    expect(pairsOf).toEqual([
      ['a', 'core-1'],
      ['a', 'core-2'],
    ]);
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
      { replaceModuleId: 'b', withModuleId: 'd', fit: 55, fitDelta: -5, keepFreeConflicts: 0 },
      { replaceModuleId: 'b', withModuleId: 'k', fit: 53, fitDelta: -7, keepFreeConflicts: 0 },
      { replaceModuleId: 'b', withModuleId: 'i', fit: 52, fitDelta: -8, keepFreeConflicts: 0 },
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
      { replaceModuleId: 'a', withModuleId: 'e', fit: 66, fitDelta: -4, keepFreeConflicts: 0 },
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

  it('puts swaps that keep kept-free time free first, and counts the sessions of those that do not', () => {
    if (!clash) throw new Error('expected a clash between a and b');
    const profile = makeProfile({ completedModuleIds: ['completed'] });
    // d, the best fit, teaches on Friday, which the student keeps free; k and i do not.
    const withFriday = [...slots, makeSlot('d', 'fri', '14:00', '16:00'), makeSlot('d', 'fri', '16:00', '17:00')];
    const keepFree = keepFreeWindows({ avoidDays: ['fri'], earliestStart: null });
    const swaps = suggestSwaps(profile, shortlist, clash, ranked, withFriday, { ...planFor(profile, electives), keepFree });
    expect(swaps.map(({ withModuleId, keepFreeConflicts: n }) => [withModuleId, n])).toEqual([
      ['k', 0],
      ['i', 0],
      ['j', 0],
    ]);
    // When every alternative uses kept-free time, they are still offered, best fit first, with the count.
    const allFriday = [...slots, ...['d', 'k', 'i', 'j'].map((id) => makeSlot(id, 'fri', '10:00', '11:00'))];
    const forced = suggestSwaps(profile, shortlist, clash, ranked, allFriday, { ...planFor(profile, electives), keepFree });
    expect(forced.map(({ withModuleId, keepFreeConflicts: n }) => [withModuleId, n])).toEqual([
      ['d', 1],
      ['k', 1],
      ['i', 1],
    ]);
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

describe('keepFreeWindows and keepFreeConflicts', () => {
  it('turns days, half days and the earliest start into windows, one per moment', () => {
    const windows = keepFreeWindows({ avoidDays: ['fri'], earliestStart: '10:00', avoidHalfDays: ['wed-pm', 'fri-am', 'tue-am'] });
    expect(windows).toEqual([
      { day: 'mon', from: '00:00', to: '10:00', reason: 'early' },
      { day: 'tue', from: '00:00', to: '12:00', reason: 'half-day' },
      { day: 'wed', from: '00:00', to: '10:00', reason: 'early' },
      { day: 'wed', from: '12:00', to: '23:59', reason: 'half-day' },
      { day: 'thu', from: '00:00', to: '10:00', reason: 'early' },
      { day: 'fri', from: '00:00', to: '23:59', reason: 'day' },
    ]);
    expect(keepFreeWindows({ avoidDays: [], earliestStart: null })).toEqual([]);
    // A start after noon with a kept-free morning still keeps 12:00 to the start free, without overlapping.
    const late = keepFreeWindows({ avoidDays: ['tue', 'wed', 'thu', 'fri'], earliestStart: '13:00', avoidHalfDays: ['mon-am'] });
    expect(late).toEqual([
      { day: 'mon', from: '00:00', to: '12:00', reason: 'half-day' },
      { day: 'mon', from: '12:00', to: '13:00', reason: 'early' },
      ...(['tue', 'wed', 'thu', 'fri'] as const).map((day) => ({ day, from: '00:00', to: '23:59', reason: 'day' })),
    ]);
  });

  it('flags sessions in a kept-free afternoon or before the earliest start, and nothing else', () => {
    const slots = [
      makeSlot('lab', 'wed', '14:00', '16:00'),
      makeSlot('lab', 'wed', '10:00', '12:00'),
      makeSlot('early', 'mon', '09:00', '11:00', { provisional: true, probability: 0.5 }),
      makeSlot('ten', 'tue', '10:00', '11:00'),
      makeSlot('other', 'wed', '14:00', '15:00'),
    ];
    // "Keep Wednesday afternoons free for sport, and nothing before 10am please."
    const windows = keepFreeWindows({ avoidDays: [], earliestStart: '10:00', avoidHalfDays: ['wed-pm'] });
    const conflicts = keepFreeConflicts(['lab', 'early', 'ten'], slots, windows);
    expect(conflicts.map(({ moduleId, slot, window }) => [moduleId, slot.day, slot.start, window.reason])).toEqual([
      ['early', 'mon', '09:00', 'early'],
      ['lab', 'wed', '14:00', 'half-day'],
    ]);
  });
});

describe("planTimetable on Rosa's plan (seed data)", () => {
  const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
  const { slots } = readDataset(DATASET_FILES.slots, SlotsFile);
  const rules = readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile).rules.find(
    (r) => r.programme === 'MEng Mechanical Engineering' && r.year === 3,
  );
  if (!rules) throw new Error('expected MEng Mechanical Engineering year 3 rules');
  const completed = ['MECH40002', 'MECH40003', 'MECH40004', 'MECH40005', 'MECH40006', 'MECH40008', 'MECH50001', 'MECH50002', 'MECH50003', 'MECH50004', 'MECH50005', 'MECH50006', 'MECH50008', 'MECH50010'];
  const profile = makeProfile({
    completedModuleIds: completed,
    interests: { 'control-robotics': 1, 'electronics-embedded': 0.9 },
    timetablePrefs: { avoidDays: ['fri'], earliestStart: null, avoidHalfDays: ['wed-pm'] },
  });
  const plan: SwapPlan = { modules, rules, check: (list) => checkShortlist(list, profile, modules, rules) };
  const ranked = rankModules(profile, modules, DEFAULT_WEIGHTS, rules);

  it('draws the core modules on the grid and counts them in the ECTS total', () => {
    const view = planTimetable(profile, ['MECH60009', 'MECH60018', 'IEX-ML'], ranked, slots, plan);
    expect(view.coreModuleIds).toEqual(['MECH60003', 'MECH60015']);
    const onGrid = new Set(view.grids.flatMap((grid) => grid.slots.map((slot) => slot.moduleId)));
    expect(onGrid).toEqual(new Set(['MECH60003', 'MECH60015', 'MECH60009', 'MECH60018', 'IEX-ML']));
    expect(view.ects).toEqual({ core: 30, elective: 10, iExplore: 5, max: 60 });
  });

  it('keeps a completed core module off the grid but in the ECTS total, as the rules check counts it', () => {
    const done = makeProfile({ ...profile, completedModuleIds: [...completed, 'MECH60003'] });
    const donePlan: SwapPlan = { modules, rules, check: (list) => checkShortlist(list, done, modules, rules) };
    const view = planTimetable(done, ['MECH60009'], ranked, slots, donePlan);
    expect(view.coreModuleIds).toEqual(['MECH60015']);
    expect(view.ects.core).toBe(30);
  });

  it('finds a clash with the core Design, Make and Test Project lab', () => {
    // Robot dynamics and control (a Year 4 module) runs Tuesday 11:00 to 13:00 in spring, over the core lab.
    const view = planTimetable(profile, ['MECH60009', 'MECH70057'], ranked, slots, plan);
    const withCore = view.clashes.find((c) => [c.moduleA, c.moduleB].includes('MECH60003'));
    expect(withCore && [withCore.moduleA, withCore.moduleB, withCore.term]).toEqual(['MECH60003', 'MECH70057', 'spring']);
    expect(view.swaps.map((swap) => swap.replaceModuleId)).not.toContain('MECH60003');
  });

  it('flags the Friday labs as kept-free conflicts without touching fit or ranking', () => {
    const view = planTimetable(profile, ['MECH60001', 'MECH60018'], ranked, slots, plan);
    expect(view.keepFreeConflicts.map(({ moduleId, slot }) => `${moduleId} ${slot.term} ${slot.day} ${slot.start}`)).toEqual([
      'MECH60001 autumn fri 11:00',
      'MECH60001 spring fri 16:00',
    ]);
    // Keep-free time is a timetable preference only: the same student without it gets identical fits and order.
    const without = makeProfile({ ...profile, timetablePrefs: { avoidDays: [], earliestStart: null } });
    expect(rankModules(without, modules, DEFAULT_WEIGHTS, rules)).toEqual(ranked);
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
