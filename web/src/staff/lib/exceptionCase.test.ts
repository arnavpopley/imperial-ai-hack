// Issue 49: the Senior Tutor's actions on a rule exception, and the broken rule shown as data.
import { schemas, type ExceptionRequest } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { approvalOpensModule, respondBody, ruleRows, subScoreText } from './exceptionCase.ts';

describe('respondBody', () => {
  it('sends a decision with an optional message, and every body passes the shared schema', () => {
    const approve = respondBody('approve', '  Do the bridging notes.  ');
    expect(approve).toEqual({ decision: 'approve', response: 'Do the bridging notes.', resolve: true });
    const decline = respondBody('decline', '');
    expect(decline).toEqual({ decision: 'decline', response: '', resolve: true });
    for (const body of [approve, decline]) expect(schemas.EscalationRespondBody.safeParse(body).success).toBe(true);
  });

  it('needs text for a plain reply', () => {
    expect(respondBody('reply', '   ')).toBeNull();
    expect(respondBody('reply', 'Thanks, noted.')).toEqual({ response: 'Thanks, noted.', resolve: true });
  });
});

describe('ruleRows', () => {
  it('labels each rule and keeps the missing prerequisite as data', () => {
    const [row] = ruleRows([
      { code: 'PREREQUISITE_MISSING', moduleId: 'ME3-ROB', prerequisiteId: 'ME2-CTRL', message: 'Needs ME2-CTRL.' },
    ]);
    expect(row).toEqual({
      code: 'PREREQUISITE_MISSING',
      label: 'Prerequisite not completed',
      moduleId: 'ME3-ROB',
      prerequisiteId: 'ME2-CTRL',
      detail: 'Needs ME2-CTRL.',
    });
    expect(ruleRows([{ code: 'NOT_ALLOWED', moduleId: 'X', message: 'm' }])[0]?.prerequisiteId).toBeNull();
  });
});

describe('approvalOpensModule', () => {
  const request = (violations: ExceptionRequest['violations']): ExceptionRequest => ({ moduleId: 'X', violations, reason: '', completedModuleIds: [], fit: null });

  it('is true only when the module itself breaks a rule that can be waived', () => {
    expect(approvalOpensModule(request([{ code: 'NOT_ALLOWED', moduleId: 'X', message: 'm' }]))).toBe(true);
    expect(approvalOpensModule(request([{ code: 'PREREQUISITE_MISSING', moduleId: 'X', prerequisiteId: 'P', message: 'm' }]))).toBe(true);
    expect(approvalOpensModule(request([{ code: 'ECTS_CAP_EXCEEDED', moduleId: null, message: 'm' }]))).toBe(false);
    expect(approvalOpensModule({ ...request([{ code: 'NOT_ALLOWED', moduleId: 'X', message: 'm' }]), moduleId: null })).toBe(false);
    expect(approvalOpensModule(null)).toBe(false);
  });
});

describe('subScoreText', () => {
  it('leaves out the goal score when there is none', () => {
    expect(subScoreText({ interest: 0.8, goal: null, style: 0.55, breadth: 0.1 })).toBe('interest 80% · style 55% · breadth 10%');
    expect(subScoreText({ interest: 0.8, goal: 0.7, style: 0.55, breadth: 0.1 })).toContain('goals 70%');
  });
});
