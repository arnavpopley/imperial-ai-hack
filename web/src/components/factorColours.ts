// One colour per fit factor (issue 137), the same in the weight panel, its mix bar, every sub-score bar and the
// compare drawer, so the legend a student learns beside the sliders carries over. Literal class strings, so
// Tailwind can see each one.
import type { Recommendation } from '@modulematch/shared';

export type FactorKey = keyof Recommendation['sub'];

export interface FactorColour {
  fill: string;
  border: string;
}

export const FACTOR_COLOURS: Record<FactorKey, FactorColour> = {
  interest: { fill: 'bg-factor-interest', border: 'border-factor-interest' },
  goal: { fill: 'bg-factor-goal', border: 'border-factor-goal' },
  style: { fill: 'bg-factor-style', border: 'border-factor-style' },
  breadth: { fill: 'bg-factor-breadth', border: 'border-factor-breadth' },
};
