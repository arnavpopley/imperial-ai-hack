// Issue 144: interest strength on the "Here is what I heard" card, as a three-step dot row.

export type StrengthStep = 1 | 2 | 3;

/** Strong at 0.8 or more, medium at 0.6 or more, light below. */
export function strengthStep(strength: number): StrengthStep {
  if (strength >= 0.8) return 3;
  if (strength >= 0.6) return 2;
  return 1;
}

export const STRENGTH_LABELS: Record<StrengthStep, string> = { 1: 'light interest', 2: 'medium interest', 3: 'strong interest' };
