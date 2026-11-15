// Issue 51: the catalogue and onboarding say when the rules for a year are not loaded.
import { describe, expect, it } from 'vitest';
import { catalogueCount, noRulesHint, yearsWithoutRules } from './rulesStatus.ts';

const status = (loaded: boolean) => ({ programme: 'MEng Mechanical Engineering', year: 1, loaded, maxModuleLevel: 1, note: 'n' });

describe('catalogueCount', () => {
  it('counts open modules when the rules are loaded, and says eligibility is not confirmed when they are not', () => {
    expect(catalogueCount(46, 33, status(true))).toBe('46 modules · 33 open to you');
    expect(catalogueCount(46, 0, status(false))).toBe('46 modules · eligibility not confirmed for Year 1');
    expect(catalogueCount(46, 33, undefined)).toBe('46 modules · 33 open to you');
  });
});

describe('yearsWithoutRules', () => {
  const info = [
    {
      programme: 'MEng Mechanical Engineering',
      years: [
        { year: 1 as const, rulesLoaded: false },
        { year: 2 as const, rulesLoaded: false },
        { year: 3 as const, rulesLoaded: true },
        { year: 4 as const, rulesLoaded: true },
      ],
    },
  ];

  it('lists the years with no rules, every year for an unknown programme, and none before the data arrives', () => {
    expect([...yearsWithoutRules(info, 'MEng Mechanical Engineering')]).toEqual([1, 2]);
    expect([...yearsWithoutRules(info, 'BSc Something Else')]).toEqual([1, 2, 3, 4]);
    expect([...yearsWithoutRules(undefined, 'MEng Mechanical Engineering')]).toEqual([]);
  });

  it('explains what a missing year means', () => {
    expect(noRulesHint('2')).toContain("doesn't have the rules for Year 2");
  });
});
