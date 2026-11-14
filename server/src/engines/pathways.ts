// Spec 9.4: career pathway progress and the next-best module.
import type { Module, Pathway, PathwayProgress, Recommendation, SkillId, StudentProfile } from '@modulematch/shared';
import { compareIds } from './util.ts';

type SkillTotals = Record<SkillId, number>;

function addSkills(totals: SkillTotals, module: Module): SkillTotals {
  const next = { ...totals };
  for (const [skill, contribution] of Object.entries(module.skills)) next[skill] = (next[skill] ?? 0) + contribution;
  return next;
}

/** min(1, Σ_m u_{m,k}): a skill counts as fully covered once its contributions reach 1. */
const coverage = (totals: SkillTotals, skill: SkillId): number => Math.min(1, totals[skill] ?? 0);

/** Spec 9.4: Progress = Σ_k q_k min(1, Σ_m u_mk) / Σ_k q_k. */
function progressOf(pathway: Pathway, totals: SkillTotals): number {
  let covered = 0;
  let importance = 0;
  for (const [skill, weight] of Object.entries(pathway.skills)) {
    covered += weight * coverage(totals, skill);
    importance += weight;
  }
  return importance > 0 ? covered / importance : 0;
}

/**
 * Spec 9.4: progress over completed plus shortlisted modules, with a per-skill breakdown (most important
 * first). The next-best module is the eligible, not yet taken or shortlisted module with the largest
 * marginal gain, tie-broken by module id; null when no module adds anything.
 */
export function pathwayProgress(
  profile: StudentProfile,
  pathway: Pathway,
  modules: readonly Module[],
  shortlist: readonly string[],
  ranked: readonly Recommendation[],
): PathwayProgress {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const taken = new Set([...profile.completedModuleIds, ...shortlist]);
  const totals = [...taken].flatMap((id) => byId.get(id) ?? []).reduce<SkillTotals>(addSkills, {});
  const progress = progressOf(pathway, totals);

  const perSkill = Object.entries(pathway.skills)
    .sort(([skillA, a], [skillB, b]) => b - a || compareIds(skillA, skillB))
    .map(([skill, importance]) => ({ skill, importance, covered: coverage(totals, skill) }));

  const nextBest =
    ranked
      .filter((recommendation) => recommendation.eligible && !taken.has(recommendation.moduleId))
      .flatMap((recommendation) => byId.get(recommendation.moduleId) ?? [])
      .map((module) => ({ moduleId: module.id, gain: progressOf(pathway, addSkills(totals, module)) - progress }))
      .filter((candidate) => candidate.gain > 0)
      .sort((a, b) => b.gain - a.gain || compareIds(a.moduleId, b.moduleId))[0] ?? null;

  return { pathwayId: pathway.id, progress, perSkill, nextBest };
}
