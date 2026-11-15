// Issue #68: a backup for a shortlisted option that the cohort's demand puts near or over capacity, chosen with
// the same checks as timetable swaps.
import type { ModuleDemandSignal, ProgrammeRules, Recommendation, StudentProfile } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { capacityBackups, checkShortlist, type SwapPlan } from '../src/engines/index.ts';
import { makeModule, makeProfile, makeRules, makeSlot } from './engines-fixtures.ts';

const rec = (moduleId: string, fit: number, eligible = true): Recommendation => ({
  moduleId,
  fit,
  sub: { interest: 0, goal: null, style: 0, breadth: 0 },
  eligible,
  ineligibleReasons: [],
  confidence: 'high',
});

const modules = [
  makeModule('popular'),
  makeModule('other'),
  makeModule('also-popular'),
  makeModule('clashes-with-other'),
  makeModule('clashes-with-popular'),
  makeModule('ineligible'),
  makeModule('steady'),
  makeModule('iexplore', { type: 'i-explore' }),
  makeModule('core-module', { type: 'core' }),
];
const slots = [
  makeSlot('popular', 'mon', '09:00', '10:00'),
  makeSlot('other', 'tue', '09:00', '10:00'),
  makeSlot('also-popular', 'wed', '09:00', '10:00'),
  makeSlot('clashes-with-other', 'tue', '09:30', '10:30'),
  makeSlot('clashes-with-popular', 'mon', '09:30', '10:30'),
  makeSlot('ineligible', 'thu', '09:00', '10:00'),
  makeSlot('steady', 'thu', '11:00', '12:00'),
  makeSlot('iexplore', 'fri', '09:00', '10:00'),
  makeSlot('core-module', 'fri', '11:00', '12:00'),
];
const ranked = [
  rec('popular', 70),
  rec('other', 60),
  rec('also-popular', 95),
  rec('clashes-with-other', 90),
  rec('ineligible', 85, false),
  rec('iexplore', 80),
  rec('clashes-with-popular', 75),
  rec('steady', 40),
];
const signal = (moduleId: string, status: ModuleDemandSignal['status'] = 'over'): [string, ModuleDemandSignal] => [
  moduleId,
  { moduleId, status, shortlisted: 60, capacity: 48 },
];
const planFor = (profile: StudentProfile, rules: Partial<ProgrammeRules> = {}): SwapPlan => {
  const programme = makeRules({ allowedElectiveIds: modules.map((m) => m.id), coreModuleIds: ['core-module'], ...rules });
  return { modules, rules: programme, check: (list) => checkShortlist(list, profile, modules, programme) };
};

describe('capacityBackups', () => {
  const profile = makeProfile();
  const shortlist = ['popular', 'other'];

  it('offers the best eligible elective that is not popular itself, does not clash and is not shortlisted', () => {
    const demand = new Map([signal('popular'), signal('also-popular', 'near')]);
    const [backup, ...more] = capacityBackups(profile, shortlist, ranked, slots, planFor(profile), demand);
    expect(more).toEqual([]);
    // also-popular is near capacity, clashes-with-other clashes with the plan, ineligible is not eligible and
    // iexplore is another kind; clashes-with-popular only clashes with the pick it would replace.
    expect(backup).toMatchObject({ replaceModuleId: 'popular', withModuleId: 'clashes-with-popular', status: 'over', fit: 75, fitDelta: 5 });
    expect(backup?.canAdd).toBe(false);
  });

  it('says the backup can sit beside the pick when both fit the plan', () => {
    const demand = new Map([signal('popular'), signal('also-popular'), signal('clashes-with-popular')]);
    const [backup] = capacityBackups(profile, shortlist, ranked, slots, planFor(profile), demand);
    expect(backup).toMatchObject({ withModuleId: 'steady', canAdd: true, fitDelta: -30 });
  });

  it('only adds when the rules allow keeping both, such as the ECTS cap', () => {
    const demand = new Map([signal('popular'), signal('also-popular'), signal('clashes-with-popular')]);
    const [backup] = capacityBackups(profile, shortlist, ranked, slots, planFor(profile, { maxEcts: 15 }), demand);
    expect(backup).toMatchObject({ withModuleId: 'steady', canAdd: false });
  });

  it('never offers to add when the plan is already over the ECTS cap', () => {
    const demand = new Map([signal('popular'), signal('also-popular'), signal('clashes-with-popular')]);
    const over = ['popular', 'other', 'iexplore'];
    const [backup] = capacityBackups(profile, over, ranked, slots, planFor(profile, { maxEcts: 10 }), demand);
    expect(backup?.canAdd).toBe(false);
  });

  it('suggests nothing for picks with calm demand, for core modules, or when no candidate passes', () => {
    expect(capacityBackups(profile, shortlist, ranked, slots, planFor(profile), new Map())).toEqual([]);
    expect(capacityBackups(profile, ['core-module'], ranked, slots, planFor(profile), new Map([signal('core-module')]))).toEqual([]);
    const busy = new Map(['popular', 'also-popular', 'clashes-with-popular', 'steady'].map((id) => signal(id)));
    expect(capacityBackups(profile, shortlist, ranked, slots, planFor(profile), busy)).toEqual([]);
  });
});
