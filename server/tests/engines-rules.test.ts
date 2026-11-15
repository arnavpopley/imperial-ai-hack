// Spec 9.1: programme rules validator.
import type { RulesResult } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { checkModuleEligibility, checkShortlist } from '../src/engines/index.ts';
import { makeModule, makeProfile, makeRules } from './engines-fixtures.ts';

const modules = [
  makeModule('core-a', { type: 'core', ects: 20, terms: ['autumn'] }),
  makeModule('core-b', { type: 'core', ects: 20, terms: ['spring'] }),
  makeModule('fluids', { title: 'Fluids 2', ects: 5, terms: ['autumn'] }),
  makeModule('cfd', { ects: 5, terms: ['spring'], prerequisites: ['fluids'] }),
  makeModule('robots', { ects: 5, terms: ['spring'] }),
  makeModule('closed', { ects: 5 }),
  makeModule('iex', { type: 'i-explore', ects: 5, terms: ['autumn', 'spring'] }),
];
const rules = makeRules({
  coreModuleIds: ['core-a', 'core-b'],
  allowedElectiveIds: ['fluids', 'cfd', 'robots'],
  electiveEctsRequired: 10,
  maxEcts: 60,
  iExploreRequired: true,
});
const profile = makeProfile({ completedModuleIds: ['fluids'] });
const codes = (result: RulesResult) => result.violations.map((v) => v.code);

describe('checkModuleEligibility', () => {
  it('names the missing prerequisite by id', () => {
    const [violation, ...rest] = checkModuleEligibility('cfd', makeProfile(), modules, rules);
    expect(rest).toEqual([]);
    expect(violation).toMatchObject({ code: 'PREREQUISITE_MISSING', moduleId: 'cfd' });
    expect(violation?.message).toContain('fluids (Fluids 2)');
    expect(checkModuleEligibility('cfd', profile, modules, rules)).toEqual([]);
  });

  it('allows core, approved electives and any I-Explore module, and nothing else', () => {
    expect(checkModuleEligibility('core-a', profile, modules, rules)).toEqual([]);
    expect(checkModuleEligibility('iex', profile, modules, rules)).toEqual([]);
    expect(checkModuleEligibility('closed', profile, modules, rules).map((v) => v.code)).toEqual(['NOT_ALLOWED']);
  });

  it('flags unknown module ids', () => {
    expect(checkModuleEligibility('nope', profile, modules, rules).map((v) => v.code)).toEqual(['UNKNOWN_MODULE']);
  });

  it('names the missing prerequisite as data', () => {
    expect(checkModuleEligibility('cfd', makeProfile(), modules, rules)[0]?.prerequisiteId).toBe('fluids');
  });

  it('waives the programme and prerequisite checks for a Senior Tutor exception, and only for that module', () => {
    expect(checkModuleEligibility('cfd', makeProfile(), modules, rules, ['cfd'])).toEqual([]);
    expect(checkModuleEligibility('closed', profile, modules, rules, ['closed'])).toEqual([]);
    expect(checkModuleEligibility('closed', profile, modules, rules, ['cfd']).map((v) => v.code)).toEqual(['NOT_ALLOWED']);
    expect(checkModuleEligibility('nope', profile, modules, rules, ['nope']).map((v) => v.code)).toEqual(['UNKNOWN_MODULE']);
  });
});

describe('checkShortlist', () => {
  it('passes a valid plan', () => {
    expect(checkShortlist(['cfd', 'robots', 'iex'], profile, modules, rules)).toEqual({
      ok: true,
      violations: [],
      warnings: [],
    });
  });

  it('reports every broken rule', () => {
    const result = checkShortlist(['closed', 'nope'], makeProfile(), modules, rules);
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(['NOT_ALLOWED', 'UNKNOWN_MODULE', 'ELECTIVE_ECTS_SHORT', 'I_EXPLORE_MISSING']);
    expect(result.violations.find((v) => v.code === 'ELECTIVE_ECTS_SHORT')?.message).toContain('Add at least 5 ECTS');
  });

  it('honours exceptions: an approved module is allowed and left out of the ECTS cap', () => {
    const result = checkShortlist(['closed', 'cfd', 'robots', 'iex'], profile, modules, { ...rules, maxEcts: 55 }, ['closed']);
    expect(result).toMatchObject({ ok: true, violations: [] });
    const over = checkShortlist(['closed', 'cfd', 'robots', 'iex'], profile, modules, { ...rules, maxEcts: 50 }, ['closed']);
    expect(over.violations[0]?.message).toContain('55 ECTS including core modules, not counting modules with an approved exception,');
  });

  it('counts core modules towards the ECTS cap', () => {
    const result = checkShortlist(['cfd', 'robots', 'iex'], profile, modules, { ...rules, maxEcts: 50 });
    expect(codes(result)).toEqual(['ECTS_CAP_EXCEEDED']);
    expect(result.violations[0]?.message).toContain('55 ECTS');
  });

  it('warns when more than 60% of ECTS falls in one term, splitting multi-term modules evenly', () => {
    const autumnOnly = makeRules({ allowedElectiveIds: ['fluids', 'robots'] });
    // autumn 5 + 2.5, spring 2.5: 75% autumn.
    const heavy = checkShortlist(['fluids', 'iex'], profile, modules, autumnOnly);
    expect(heavy.ok).toBe(true);
    expect(heavy.warnings).toHaveLength(1);
    expect(heavy.warnings[0]?.code).toBe('TERM_IMBALANCE');
    expect(heavy.warnings[0]?.message).toContain('75%');
    expect(heavy.warnings[0]?.message).toContain('autumn');
    // autumn 5 + 2.5, spring 2.5 + 5: 50% each.
    expect(checkShortlist(['fluids', 'iex', 'robots'], profile, modules, autumnOnly).warnings).toEqual([]);
  });

  it('does not warn at exactly 60%', () => {
    const balanced = [
      makeModule('a', { ects: 15, terms: ['autumn'] }),
      makeModule('b', { ects: 10, terms: ['spring'] }),
    ];
    const open = makeRules({ allowedElectiveIds: ['a', 'b'] });
    expect(checkShortlist(['a', 'b'], profile, balanced, open).warnings).toEqual([]);
  });
});
