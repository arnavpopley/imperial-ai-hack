// Issue 49: a rule-exception draft needs a one-line reason, and a Senior Tutor decision refreshes the ranking.
import type { Escalation } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { canSendDraft, decisionsKey, draftIdentity, EXCEPTION_LABELS, oneLine } from './exceptions.ts';

const escalation = (id: string, decision: Escalation['decision']): Escalation => ({
  id,
  sessionId: 's',
  type: 'RULE_EXCEPTION',
  summary: 'x',
  status: decision ? 'resolved' : 'open',
  staffResponse: null,
  createdAt: 'now',
  request: null,
  decision,
});

describe('canSendDraft', () => {
  it('needs a reason for a rule exception only', () => {
    expect(canSendDraft('RULE_EXCEPTION', 'Summary', '')).toBe(false);
    expect(canSendDraft('RULE_EXCEPTION', 'Summary', '  ')).toBe(false);
    expect(canSendDraft('RULE_EXCEPTION', 'Summary', 'I did it on placement.')).toBe(true);
    expect(canSendDraft('COMPLAINT', 'Summary', '')).toBe(true);
    expect(canSendDraft('COMPLAINT', ' ', '')).toBe(false);
  });
});

describe('oneLine', () => {
  it('folds pasted line breaks into spaces', () => {
    expect(oneLine('First part\n\n  second part')).toBe('First part second part');
  });
});

describe('decisionsKey', () => {
  it('changes when a decision lands, and not before', () => {
    const open = decisionsKey({ exceptions: [], escalations: [escalation('a', null)] });
    const approved = decisionsKey({ exceptions: [{ moduleId: 'MECH70057', waived: [{ code: 'NOT_ALLOWED' }] }], escalations: [escalation('a', 'approved')] });
    expect(open).toBe('');
    expect(approved).not.toBe(open);
    expect(decisionsKey({ exceptions: [], escalations: [escalation('a', 'declined')] })).not.toBe(open);
  });
});

describe('draftIdentity', () => {
  it('tells apart drafts with the same summary but a new reason or module', () => {
    const draft = { type: 'RULE_EXCEPTION' as const, summary: 'Same summary.', moduleId: 'MECH70057', reason: 'First.' };
    expect(draftIdentity(draft)).toBe(draftIdentity({ ...draft }));
    expect(draftIdentity({ ...draft, reason: 'Second.' })).not.toBe(draftIdentity(draft));
    expect(draftIdentity({ ...draft, moduleId: 'MECH70058' })).not.toBe(draftIdentity(draft));
  });
});

describe('EXCEPTION_LABELS', () => {
  it('says who decided', () => {
    expect(EXCEPTION_LABELS.approved).toBe('Exception approved by the Senior Tutor');
    expect(EXCEPTION_LABELS.declined).toBe('Exception declined by the Senior Tutor');
  });
});
