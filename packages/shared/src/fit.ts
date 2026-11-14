import type { Recommendation, Weights } from './types.ts';

/**
 * Spec 8.5: combine sub-scores into a 0-100 fit. Sub-scores do not depend on the weights, so the web
 * app can call this to re-rank instantly while a slider moves; the scoring engine uses the same function.
 * A null goal sub-score (no pathways chosen, spec 8.2) drops the goal weight to zero.
 */
export function combineFit(sub: Recommendation['sub'], weights: Weights): number {
  const wG = sub.goal === null ? 0 : weights.goal;
  const total = weights.interest + wG + weights.style + weights.breadth;
  if (total <= 0) return 0;
  const sum =
    weights.interest * sub.interest + wG * (sub.goal ?? 0) + weights.style * sub.style + weights.breadth * sub.breadth;
  return Math.round((100 * sum) / total);
}
