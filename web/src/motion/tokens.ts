// Motion tokens for the student app, taken from the "Education & Learning" animation skill
// (.claude/skills/education-learning-animation, MIT, Copyright (c) 2024 Dylan Tarre).
// Its timing table, as named presets:
//
//   answerFeedback      200ms  ease-out       a step ticks, a module leaves the shortlist, a message appears
//   correctCelebration  600ms  spring         a module joins the shortlist
//   lessonTransition    350ms  ease-in-out    content arrives (timeline rows, first score sweep)
//   progressUpdate      300ms  ease-out       a score or a progress bar changes
//   achievementUnlock   800ms  custom bounce  the profile is complete
//
// Key principle: celebrate progress generously, handle mistakes gently. Every animation goes through
// useMotionTokens so that reduced motion gets an instant change or an opacity-only fade instead.
import { useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { useMemo } from 'react';

/** Durations in seconds, as motion expects. */
export const DURATION = {
  answerFeedback: 0.2,
  correctCelebration: 0.6,
  lessonTransition: 0.35,
  progressUpdate: 0.3,
  achievementUnlock: 0.8,
} as const;

/** Cubic-bezier curves. ease-out decelerates into place; ease-in-out is for content that travels. */
export const EASE = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/**
 * The achievement bounce: grow past full size, dip back, then settle. Used as keyframes with
 * `MOTION.achievementUnlock`, whose `times` line up with these values.
 */
export const ACHIEVEMENT_BOUNCE = [0.7, 1.08, 0.97, 1] as const;

export const MOTION = {
  answerFeedback: { duration: DURATION.answerFeedback, ease: EASE.out },
  correctCelebration: { type: 'spring', duration: DURATION.correctCelebration, bounce: 0.45 },
  lessonTransition: { duration: DURATION.lessonTransition, ease: EASE.inOut },
  progressUpdate: { duration: DURATION.progressUpdate, ease: EASE.out },
  achievementUnlock: { duration: DURATION.achievementUnlock, ease: EASE.out, times: [0, 0.5, 0.78, 1] },
  /** Follow-through for numbers: a short, lively spring on the progress-update clock, so a value settles. */
  settle: { type: 'spring', duration: DURATION.progressUpdate, bounce: 0.5 },
} as const satisfies Record<string, Transition>;

export type MotionPreset = keyof typeof MOTION;

/** Reduced motion: change at once. */
export const INSTANT: Transition = { duration: 0 };
/** Reduced motion, where a cue still helps: opacity only, on the feedback clock. */
export const FADE_ONLY: Transition = { duration: DURATION.answerFeedback, ease: 'easeOut' };

export interface EnterProps {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}

export interface MotionTokens {
  /** True when the student asked the system for reduced motion. */
  reduce: boolean;
  /** The named preset, or an instant change under reduced motion. */
  transition: (preset: MotionPreset, delay?: number) => Transition;
  /**
   * A soft entrance: rises a few pixels and fades in, with no shake or flash. Under reduced motion it
   * fades only. Used for gentle error and empty states as well as new content.
   */
  softEnter: (preset?: MotionPreset, rise?: number) => EnterProps;
}

export function useMotionTokens(): MotionTokens {
  const reduce = useReducedMotion() ?? false;
  return useMemo<MotionTokens>(
    () => ({
      reduce,
      transition: (preset, delay = 0) => (reduce ? INSTANT : { ...MOTION[preset], delay }),
      softEnter: (preset = 'answerFeedback', rise = 4) =>
        reduce
          ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: FADE_ONLY }
          : {
              initial: { opacity: 0, y: rise },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -rise / 2 },
              transition: MOTION[preset],
            },
    }),
    [reduce],
  );
}
