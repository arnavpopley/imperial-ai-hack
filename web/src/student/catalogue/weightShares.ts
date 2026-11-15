// The weight sliders hold raw importance (0 to 1); the fit score uses each weight's share of the total. The sliders
// show the raw level as a word, and a stacked bar shows the shares, so a thumb never disagrees with its number.
import type { Weights } from '@modulematch/shared';

type WeightKey = keyof Weights;

/** A word for a slider's raw value, shown beside its thumb. */
export function levelWord(value: number): string {
  if (value <= 0) return 'Off';
  if (value <= 0.15) return 'Low';
  if (value <= 0.35) return 'Medium';
  if (value <= 0.6) return 'High';
  return 'Very high';
}

/**
 * Whole-number percentage shares of the fit score, summing to exactly 100 when any weight is on (largest
 * remainder). Career counts only when the student has a pathway.
 */
export function weightShares(weights: Weights, goalUsed: boolean): Record<WeightKey, number> {
  const keys: WeightKey[] = ['interest', 'goal', 'style', 'breadth'];
  const used = (k: WeightKey) => (k === 'goal' && !goalUsed ? 0 : Math.max(0, weights[k]));
  const total = keys.reduce((sum, k) => sum + used(k), 0);
  const shares = { interest: 0, goal: 0, style: 0, breadth: 0 };
  if (total <= 0) return shares;
  const exact = keys.map((k) => ({ k, x: (used(k) / total) * 100 }));
  for (const { k, x } of exact) shares[k] = Math.floor(x);
  let left = 100 - keys.reduce((sum, k) => sum + shares[k], 0);
  for (const { k } of [...exact].sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)))) {
    if (left <= 0) break;
    if (used(k) > 0) {
      shares[k] += 1;
      left -= 1;
    }
  }
  return shares;
}
