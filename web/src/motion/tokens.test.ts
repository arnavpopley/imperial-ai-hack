// Keeps the motion presets in step with the Education & Learning skill's timing table.
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_BOUNCE, DURATION, MOTION } from './tokens.ts';

describe('motion tokens', () => {
  it('match the skill timing table', () => {
    expect(DURATION).toEqual({
      answerFeedback: 0.2,
      correctCelebration: 0.6,
      lessonTransition: 0.35,
      progressUpdate: 0.3,
      achievementUnlock: 0.8,
    });
    expect(MOTION.correctCelebration.type).toBe('spring');
    expect(MOTION.achievementUnlock.times).toHaveLength(ACHIEVEMENT_BOUNCE.length);
  });

  it('bounce overshoots, dips back and settles at full size', () => {
    const [from, peak, dip, end] = ACHIEVEMENT_BOUNCE;
    expect(peak).toBeGreaterThan(1);
    expect(dip).toBeLessThan(1);
    expect(from).toBeLessThan(dip);
    expect(end).toBe(1);
  });
});
