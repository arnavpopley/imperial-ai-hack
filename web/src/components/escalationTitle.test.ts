// Issue 107: distinct titles for escalations, and one map of plain names for rule codes.
import { RULE_CODE_LABELS, schemas } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { escalationTitle, requestModule } from './escalationTitle.ts';

const modules: Record<string, { code: string; title: string }> = {
  MECH70002: { code: 'MECH70002', title: 'Nuclear Reactor Physics' },
  MECH70057: { code: 'MECH70057', title: 'Robot dynamics and control' },
};
const moduleOf = (id: string) => modules[id];
const request = (moduleId: string | null) => ({ moduleId, violations: [], reason: '', completedModuleIds: [], fit: null });

describe('escalationTitle', () => {
  it('names the module and the kind of request, so two requests read differently', () => {
    const a = escalationTitle({ type: 'RULE_EXCEPTION', request: request('MECH70002') }, moduleOf);
    const b = escalationTitle({ type: 'RULE_EXCEPTION', request: request('MECH70057') }, moduleOf);
    expect(a).toBe('MECH70002 Nuclear Reactor Physics · Rule exception');
    expect(b).toBe('MECH70057 Robot dynamics and control · Rule exception');
  });

  it('falls back to the kind of request, or the bare id for a module no longer in the catalogue', () => {
    expect(escalationTitle({ type: 'WELLBEING', request: null }, moduleOf)).toBe('Wellbeing hand-off');
    expect(escalationTitle({ type: 'RULE_EXCEPTION', request: request(null) }, moduleOf)).toBe('Rule exception');
    expect(escalationTitle({ type: 'RULE_EXCEPTION', request: request('GONE1') }, moduleOf)).toBe('GONE1 · Rule exception');
    expect(requestModule({ request: request('MECH70057') }, moduleOf)?.title).toBe('Robot dynamics and control');
  });
});

describe('RULE_CODE_LABELS', () => {
  it('has a plain name for every rule code, none of them the code itself', () => {
    for (const code of schemas.RuleViolation.shape.code.options) {
      expect(RULE_CODE_LABELS[code]).toBeTruthy();
      expect(RULE_CODE_LABELS[code]).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
