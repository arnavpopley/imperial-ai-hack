// Spec 9.1: programme rules validator. A violation is a hard gate that no agent can override.
import type {
  Module,
  ProgrammeRules,
  RuleViolation,
  RuleWarning,
  RulesResult,
  StudentProfile,
  Term,
} from '@modulematch/shared';
import { moduleName, roundTo, TERMS, unique } from './util.ts';

/** Spec 9.1: warn when more than this share of the plan's ECTS falls in a single term. */
export const TERM_IMBALANCE_SHARE = 0.6;

const sumEcts = (modules: readonly Module[]): number => modules.reduce((sum, module) => sum + module.ects, 0);

const formatEcts = (ects: number): string => String(roundTo(ects, 1));

/** Core modules, approved electives and every I-Explore module are open to the programme (spec 9.1). */
function isAllowed(module: Module, rules: ProgrammeRules): boolean {
  return (
    module.type === 'i-explore' ||
    rules.coreModuleIds.includes(module.id) ||
    rules.allowedElectiveIds.includes(module.id)
  );
}

function unknownModule(moduleId: string): RuleViolation {
  return {
    code: 'UNKNOWN_MODULE',
    moduleId,
    message: `Module ${moduleId} is not in the catalogue, so it cannot be added to your plan.`,
  };
}

/**
 * Spec 9.1 per-module checks used by rankModules and checkShortlist: the module exists, is allowed for
 * the programme, and every prerequisite is in the student's completed modules. Empty means eligible.
 */
export function checkModuleEligibility(
  moduleId: string,
  profile: StudentProfile,
  modules: readonly Module[],
  rules: ProgrammeRules,
): RuleViolation[] {
  const module = modules.find((candidate) => candidate.id === moduleId);
  if (!module) return [unknownModule(moduleId)];

  const violations: RuleViolation[] = [];
  if (!isAllowed(module, rules)) {
    violations.push({
      code: 'NOT_ALLOWED',
      moduleId,
      message: `${moduleName(module)} is not open to ${rules.programme} year ${rules.year} students. You can choose the programme's core modules, its approved electives and I-Explore modules.`,
    });
  }

  const completed = new Set(profile.completedModuleIds);
  for (const prerequisiteId of module.prerequisites.filter((id) => !completed.has(id))) {
    const prerequisite = modules.find((candidate) => candidate.id === prerequisiteId);
    const named = prerequisite ? `${prerequisiteId} (${prerequisite.title})` : prerequisiteId;
    violations.push({
      code: 'PREREQUISITE_MISSING',
      moduleId,
      message: `${moduleName(module)} requires ${named}, which is not among your completed modules.`,
    });
  }
  return violations;
}

/**
 * Spec 9.1 term balance: a multi-term module's ECTS are split evenly across its terms, and a warning is
 * raised for any term holding more than TERM_IMBALANCE_SHARE of the plan.
 */
function termImbalance(plan: readonly Module[]): RuleWarning[] {
  const total = sumEcts(plan);
  if (total <= 0) return [];
  const perTerm = new Map<Term, number>();
  for (const module of plan) {
    for (const term of module.terms) perTerm.set(term, (perTerm.get(term) ?? 0) + module.ects / module.terms.length);
  }
  return TERMS.flatMap((term): RuleWarning[] => {
    const ects = perTerm.get(term) ?? 0;
    if (ects / total <= TERM_IMBALANCE_SHARE) return [];
    return [
      {
        code: 'TERM_IMBALANCE',
        message: `${Math.round((100 * ects) / total)}% of your ECTS (${formatEcts(ects)} of ${formatEcts(total)}) falls in the ${term} term. Consider swapping a module for one in another term to spread the workload.`,
      },
    ];
  });
}

/**
 * Spec 9.1: validate a shortlist. The plan is the shortlist plus the programme's core modules; ECTS cap
 * and term balance apply to the whole plan, and the elective requirement to shortlisted electives and
 * I-Explore modules.
 */
export function checkShortlist(
  shortlist: readonly string[],
  profile: StudentProfile,
  modules: readonly Module[],
  rules: ProgrammeRules,
): RulesResult {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const chosenIds = unique(shortlist);
  const violations = chosenIds.flatMap((id) => checkModuleEligibility(id, profile, modules, rules));

  const plan = unique([...rules.coreModuleIds, ...chosenIds]).flatMap((id) => byId.get(id) ?? []);
  const totalEcts = sumEcts(plan);
  if (totalEcts > rules.maxEcts) {
    violations.push({
      code: 'ECTS_CAP_EXCEEDED',
      moduleId: null,
      message: `Your plan totals ${formatEcts(totalEcts)} ECTS including core modules, which is over the ${formatEcts(rules.maxEcts)} ECTS limit. Remove at least ${formatEcts(totalEcts - rules.maxEcts)} ECTS.`,
    });
  }

  const electives = chosenIds
    .flatMap((id) => byId.get(id) ?? [])
    .filter((module) => module.type !== 'core' && !rules.coreModuleIds.includes(module.id));
  const electiveEcts = sumEcts(electives);
  if (electiveEcts < rules.electiveEctsRequired) {
    violations.push({
      code: 'ELECTIVE_ECTS_SHORT',
      moduleId: null,
      message: `Your shortlist has ${formatEcts(electiveEcts)} ECTS of electives and I-Explore, but ${rules.programme} needs ${formatEcts(rules.electiveEctsRequired)}. Add at least ${formatEcts(rules.electiveEctsRequired - electiveEcts)} ECTS more.`,
    });
  }

  if (rules.iExploreRequired && !electives.some((module) => module.type === 'i-explore')) {
    violations.push({
      code: 'I_EXPLORE_MISSING',
      moduleId: null,
      message: `${rules.programme} requires one I-Explore module, and your shortlist does not have one yet.`,
    });
  }

  return { ok: violations.length === 0, violations, warnings: termImbalance(plan) };
}
