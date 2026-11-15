// Spec 9.4: career pathway progress and the next-best module.
import type { Module, Pathway, PathwayProgress, Recommendation, SkillId, StudentProfile } from '@modulematch/shared';
import { compareIds } from './util.ts';

/**
 * Spec 9.4: a module completed in an earlier year counts at this weight. Earlier years laid the foundation
 * every student on the programme shares; this year's core and chosen modules add the depth a pathway needs.
 */
export const COMPLETED_WEIGHT = 0.5;
/**
 * Spec 9.4: the skill depth scale D in covered = 1 − exp(−Σu / D). D module-equivalents of contribution cover
 * a skill to 63%, and coverage keeps rising with each module instead of saturating after the first two. Tuned
 * on the seeded Year 3 cohort, whose full plans sit between about 45% and 65%.
 */
export const SKILL_DEPTH = 3;
/** Spec 9.4: a next-best module must be at least this relevant to the pathway. */
export const NEXT_BEST_MIN_RELEVANCE = 0.5;

type SkillTotals = Record<SkillId, number>;

function addSkills(totals: SkillTotals, module: Module, weight = 1): SkillTotals {
  const next = { ...totals };
  for (const [skill, contribution] of Object.entries(module.skills)) next[skill] = (next[skill] ?? 0) + weight * contribution;
  return next;
}

/** 1 − exp(−Σ w_m u_{m,k} / D): depth in a skill with diminishing returns, approaching but never reaching 1. */
const coverage = (totals: SkillTotals, skill: SkillId): number => 1 - Math.exp(-(totals[skill] ?? 0) / SKILL_DEPTH);

/** Spec 9.4: Progress = Σ_k q_k covered_k / Σ_k q_k. */
function progressOf(pathway: Pathway, totals: SkillTotals): number {
  let covered = 0;
  let importance = 0;
  for (const [skill, weight] of Object.entries(pathway.skills)) {
    covered += weight * coverage(totals, skill);
    importance += weight;
  }
  return importance > 0 ? covered / importance : 0;
}

/** The pathway skill a module adds most to, weighted by importance (ties by skill id). */
function topSkill(pathway: Pathway, before: SkillTotals, after: SkillTotals): SkillId | null {
  let best: { skill: SkillId; gain: number } | null = null;
  for (const [skill, weight] of Object.entries(pathway.skills).sort(([a], [b]) => compareIds(a, b))) {
    const gain = weight * (coverage(after, skill) - coverage(before, skill));
    if (gain > 0 && (!best || gain > best.gain)) best = { skill, gain };
  }
  return best?.skill ?? null;
}

/**
 * Spec 9.4: progress over the student's plan, with a per-skill breakdown (most important first). The plan is
 * the completed modules (at COMPLETED_WEIGHT), this year's core modules and the shortlist. The next-best
 * module is eligible, not completed, core or shortlisted, at least NEXT_BEST_MIN_RELEVANCE relevant to the
 * pathway and adds some progress; the most relevant wins, then the best fit, then the larger gain, then the
 * module id. Null when no module qualifies.
 */
export function pathwayProgress(
  profile: StudentProfile,
  pathway: Pathway,
  modules: readonly Module[],
  shortlist: readonly string[],
  ranked: readonly Recommendation[],
  core: readonly string[] = [],
): PathwayProgress {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const completed = new Set(profile.completedModuleIds);
  const taken = new Set([...completed, ...core, ...shortlist]);
  const totals = [...taken].reduce<SkillTotals>((sum, id) => {
    const module = byId.get(id);
    return module ? addSkills(sum, module, completed.has(id) ? COMPLETED_WEIGHT : 1) : sum;
  }, {});
  const progress = progressOf(pathway, totals);

  const perSkill = Object.entries(pathway.skills)
    .sort(([skillA, a], [skillB, b]) => b - a || compareIds(skillA, skillB))
    .map(([skill, importance]) => ({ skill, importance, covered: coverage(totals, skill) }));

  const best = ranked
    .filter((recommendation) => recommendation.eligible && !taken.has(recommendation.moduleId))
    .flatMap((recommendation) => {
      const module = byId.get(recommendation.moduleId);
      const relevance = module?.pathwayRelevance[pathway.id] ?? 0;
      if (!module || relevance < NEXT_BEST_MIN_RELEVANCE) return [];
      const after = addSkills(totals, module);
      const skill = topSkill(pathway, totals, after);
      const gain = progressOf(pathway, after) - progress;
      return skill && gain > 0 ? [{ moduleId: module.id, gain, skill, relevance, fit: recommendation.fit }] : [];
    })
    .sort(
      (a, b) =>
        b.relevance - a.relevance || b.fit - a.fit || b.gain - a.gain || compareIds(a.moduleId, b.moduleId),
    )[0];

  return {
    pathwayId: pathway.id,
    progress,
    perSkill,
    nextBest: best ? { moduleId: best.moduleId, gain: best.gain, skill: best.skill } : null,
  };
}
