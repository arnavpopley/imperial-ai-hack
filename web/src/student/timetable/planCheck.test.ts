// Issue 143: an unfinished shortlist is progress, and only a real break is an issue.
import type { RuleViolation, TimetableView } from '@modulematch/shared';
import { fixtureTimetable } from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { planChecks, ruleDetails } from './planCheck.ts';

const violation = (code: RuleViolation['code'], moduleId: string | null = null): RuleViolation => ({ code, moduleId, message: `${code} message` });

const view = (overrides: Partial<TimetableView>): TimetableView => ({
  ...fixtureTimetable,
  clashes: [],
  keepFree: [],
  keepFreeConflicts: [],
  ects: { core: 30, elective: 10, iExplore: 0, max: 60, electiveRequired: 25, iExploreRequired: true },
  rules: { ok: false, violations: [violation('ELECTIVE_ECTS_SHORT'), violation('I_EXPLORE_MISSING')], warnings: [] },
  ...overrides,
});

const byId = (v: TimetableView) => Object.fromEntries(planChecks(v).map((r) => [r.id, r]));

describe('planChecks', () => {
  it('shows a partial shortlist as progress, with no issue', () => {
    const rows = byId(view({}));
    expect(rows.electives).toMatchObject({ state: 'todo', value: '10 / 25 ECTS', progress: 0.4 });
    expect(rows['i-explore']).toMatchObject({ state: 'todo', value: '0 / 1' });
    expect(rows.cap).toMatchObject({ state: 'met', value: '40 / 60 ECTS' });
    expect(rows.clashes).toMatchObject({ state: 'met', value: 'None' });
    expect(planChecks(view({})).some((r) => r.state === 'issue')).toBe(false);
  });

  it('keeps issue for real breaks: over the cap, a module not allowed, a clash', () => {
    const rows = byId(
      view({
        ects: { core: 30, elective: 30, iExplore: 5, max: 60, electiveRequired: 25, iExploreRequired: true },
        rules: { ok: false, violations: [violation('ECTS_CAP_EXCEEDED'), violation('PREREQUISITE_MISSING', 'MECH60018')], warnings: [] },
        clashes: fixtureTimetable.clashes,
      }),
    );
    expect(rows.cap).toMatchObject({ state: 'issue', value: '5 ECTS over 60' });
    expect(rows.allowed).toMatchObject({ state: 'issue', value: '1 module not allowed' });
    expect(rows.clashes).toMatchObject({ state: 'issue', value: '1 to resolve' });
    expect(rows.electives?.state).toBe('met');
  });

  it('says when a year has no rules loaded, with no invented targets', () => {
    const rows = planChecks(
      view({
        ects: { core: 0, elective: 10, iExplore: 0, max: null, electiveRequired: null, iExploreRequired: false },
        rules: { ok: true, violations: [], warnings: [{ code: 'RULES_NOT_LOADED', message: 'No rules for Year 1.' }] },
      }),
    );
    expect(rows.map((r) => r.id)).toEqual(['clashes', 'rules']);
  });

  it('puts every rule message behind the disclosure, breaks first', () => {
    const messages = ruleDetails(view({ rules: { ok: false, violations: [violation('I_EXPLORE_MISSING'), violation('NOT_ALLOWED', 'X')], warnings: [] } }));
    expect(messages).toEqual(['NOT_ALLOWED message', 'I_EXPLORE_MISSING message']);
  });
});
