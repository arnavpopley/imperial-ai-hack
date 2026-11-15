// Found by the live eval (#55 dislikes): the live extractor sometimes gives a dislike its strength of feeling, and the
// merge then stored "I'd avoid thermodynamics" as a strong interest. A disliked interest is always stored low.
import { describe, expect, it } from 'vitest';
import { emptyProfile } from '../src/agents/session.ts';
import { lowDislikes, mergeUpdates, type ExtractedUpdate } from '../src/agents/extractor.ts';

const update = (value: number, dislike: boolean, slot = 'interest:thermodynamics-energy'): ExtractedUpdate => ({
  slot,
  value,
  quote: "I'd avoid thermodynamics",
  confidence: 0.9,
  dislike,
});

describe('lowDislikes', () => {
  it('mirrors a high value on a disliked interest, and leaves low ones', () => {
    expect(lowDislikes([update(0.9, true), update(0.1, true)]).map((u) => u.value)).toEqual([0.1, 0.1]);
  });

  it('leaves liked interests and other slots alone', () => {
    expect(lowDislikes([update(0.9, false), { ...update(0.8, true), slot: 'style.examPreference' }]).map((u) => u.value)).toEqual([0.9, 0.8]);
  });

  it('stores the dislike low through the merge', () => {
    const profile = emptyProfile({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3, completedModuleIds: [], interviewDepth: 'quick' }, 's');
    const merged = mergeUpdates(profile, lowDislikes([update(0.9, true)]), { sessionId: 's', turnId: 't' }).profile;
    expect(merged.interests['thermodynamics-energy']).toBe(0.1);
  });
});
