// Contract rules enforced by the shared schemas: the controlled taxonomy and per-slot values.
import { combineFit, DEFAULT_WEIGHTS, isAllowedSlot, PROFILE_SLOTS, schemas } from '@modulematch/shared';
import { fixtureRecommendations } from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';

describe('escalation replies and exceptions', () => {
  const respond = (body: unknown) => schemas.EscalationRespondBody.safeParse(body);

  it('needs reply text unless the Senior Tutor approves or declines', () => {
    expect(respond({ response: 'Approved.' }).success).toBe(true);
    expect(respond({ response: '   ' }).success).toBe(false);
    expect(respond({}).success).toBe(false);
    expect(respond({ decision: 'approve' }).data).toEqual({ decision: 'approve', response: '', resolve: true });
    expect(respond({ decision: 'decline', response: 'The rule stands.' }).success).toBe(true);
    expect(respond({ decision: 'maybe' }).success).toBe(false);
  });

  it('keeps the reason to one short line and defaults old rows', () => {
    const body = { type: 'RULE_EXCEPTION', summary: 'x', moduleId: 'MECH70057' };
    expect(schemas.CreateEscalationBody.safeParse({ ...body, reason: 'x'.repeat(schemas.EXCEPTION_REASON_MAX) }).success).toBe(true);
    expect(schemas.CreateEscalationBody.safeParse({ ...body, reason: 'x'.repeat(schemas.EXCEPTION_REASON_MAX + 1) }).success).toBe(false);
    const old = { id: 'e', sessionId: 's', type: 'COMPLAINT', summary: 'x', status: 'open', staffResponse: null, createdAt: 'now' };
    expect(schemas.Escalation.parse(old)).toMatchObject({ request: null, decision: null });
  });
});

describe('taxonomy keys', () => {
  it('rejects an unknown topic in a profile edit', () => {
    expect(schemas.ProfileEditBody.safeParse({ interests: { 'fluid-mechanic': 0.5 } }).success).toBe(false);
  });

  it('rejects an unknown skill in a derived-tag edit', () => {
    expect(schemas.DerivedEditBody.safeParse({ skills: { juggling: 0.5 } }).success).toBe(false);
  });

  it('accepts taxonomy keys', () => {
    expect(schemas.ProfileEditBody.safeParse({ interests: { 'fluid-mechanics': 0.5 } }).success).toBe(true);
  });
});

describe('profile slot values', () => {
  const update = (slot: string, value: unknown) =>
    schemas.ProfileUpdate.safeParse({ slot, value, quote: 'q', confidence: 0.8 }).success;

  it('accepts every whitelisted slot', () => {
    for (const slot of PROFILE_SLOTS) expect(isAllowedSlot(slot)).toBe(true);
    expect(isAllowedSlot('interest:fluid-mechanics')).toBe(true);
  });

  it('rejects slots outside the whitelist', () => {
    expect(isAllowedSlot('grades')).toBe(false);
    expect(isAllowedSlot('interest:astrology')).toBe(false);
    expect(update('style.height', 0.5)).toBe(false);
  });

  it('accepts values of the right shape for each slot', () => {
    expect(update('interest:fluid-mechanics', 0.9)).toBe(true);
    expect(update('pathways', ['aerospace-motorsport'])).toBe(true);
    expect(update('pathwaysSkipped', true)).toBe(true);
    expect(update('timetablePrefs.avoidDays', ['fri'])).toBe(true);
    expect(update('timetablePrefs.earliestStart', '10:00')).toBe(true);
  });

  it('rejects values of the wrong shape', () => {
    expect(update('interest:fluid-mechanics', 'lots')).toBe(false);
    expect(update('style.examPreference', 1.5)).toBe(false);
    expect(update('pathwaysSkipped', 'yes')).toBe(false);
    expect(update('timetablePrefs.avoidDays', ['sat'])).toBe(false);
  });
});

describe('fixture recommendations', () => {
  it('use combineFit at the returned weights', () => {
    expect(fixtureRecommendations.weights).toEqual(DEFAULT_WEIGHTS);
    for (const r of fixtureRecommendations.recommendations) expect(r.fit).toBe(combineFit(r.sub, DEFAULT_WEIGHTS));
  });
});

describe('results and exam feedback contracts', () => {
  const result = (mark: number, maxMarks: number) =>
    schemas.ModuleResult.safeParse({
      moduleId: 'MECH50010',
      code: 'MECH50010',
      title: null,
      mark: 62,
      questionMarks: [{ questionId: 'Q1', mark, maxMarks }],
      matched: true,
      source: 'pasted-text',
    }).success;

  it('rejects a question mark above its maximum', () => {
    expect(result(14, 20)).toBe(true);
    expect(result(25, 20)).toBe(false);
  });

  it('rejects exam forms with duplicate question ids', () => {
    const question = (id: string) => ({ id, label: id, maxMarks: 20, topics: ['fluid-mechanics'], whatGoodAnswersDid: '', commonMistakes: [], revisionPointers: [] });
    const form = (ids: string[]) =>
      schemas.ExamFormSaveBody.safeParse({ examLabel: '2026 exam', questions: ids.map(question), generalComments: '' }).success;
    expect(form(['Q1', 'Q2'])).toBe(true);
    expect(form(['Q1', 'Q1'])).toBe(false);
  });

  it('rejects empty or non-base64 uploads', () => {
    const upload = (base64: string) => schemas.ResultsUploadBody.safeParse({ consent: true, file: { mediaType: 'application/pdf', base64 } }).success;
    expect(upload('JVBERi0xLjQK')).toBe(true);
    expect(upload('')).toBe(false);
    expect(upload('not base64!')).toBe(false);
  });
});
