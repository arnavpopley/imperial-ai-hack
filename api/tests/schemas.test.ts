// Contract rules enforced by the shared schemas: the controlled taxonomy and per-slot values.
import { combineFit, DEFAULT_WEIGHTS, isAllowedSlot, PROFILE_SLOTS, schemas } from '@modulematch/shared';
import { fixtureRecommendations } from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';

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
