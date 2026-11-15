// Spec 9.1: programme rules validator. A violation is a hard gate that no agent can override.
import type {
  Module,
  ModuleException,
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

/**
 * Spec 9.1 and issue 51: whether the student's programme rules allow a module, before prerequisites. A module the
 * rules list (core or approved elective) is allowed. Otherwise, with rules loaded, every I-Explore module up to the
 * year's level cap is allowed and anything else is not. Without rules for the year, a module above the level cap is
 * refused and any other cannot be confirmed: nothing is allowed by default. The staff module list uses this same
 * check, so it agrees with the students' recommendations.
 */
export function checkProgrammeRules(module: Module, rules: ProgrammeRules): RuleViolation[] {
  if (rules.coreModuleIds.includes(module.id) || rules.allowedElectiveIds.includes(module.id)) return [];
  const aboveLevel = rules.maxModuleLevel !== null && module.level > rules.maxModuleLevel;
  const above: RuleViolation = {
    code: 'ABOVE_YEAR_LEVEL',
    moduleId: module.id,
    message: `${moduleName(module)} is taught in Year ${module.level}, and ${rules.programme} year ${rules.year} students take modules up to Year ${rules.maxModuleLevel}.`,
  };
  if (rules.loaded) {
    if (module.type !== 'i-explore') {
      return [
        {
          code: 'NOT_ALLOWED',
          moduleId: module.id,
          message: `${moduleName(module)} is not open to ${rules.programme} year ${rules.year} students. You can choose the programme's core modules, its approved electives and I-Explore modules.`,
        },
      ];
    }
    return aboveLevel ? [above] : [];
  }
  if (aboveLevel) return [above];
  return [
    {
      code: 'RULES_NOT_LOADED',
      moduleId: module.id,
      message: `ModuleMatch does not have the ${rules.programme} rules for year ${rules.year}, so it cannot confirm that ${moduleName(module)} is open to you. Check with your department, or ask the Senior Tutor.`,
    },
  ];
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
 *
 * `exceptions` are rule exceptions the Senior Tutor approved (spec 11.1). No agent can override a violation,
 * but a person can: each exception waives exactly the rules it names for its module (the programme check or a
 * given missing prerequisite), and any other violation still applies.
 */
export function checkModuleEligibility(
  moduleId: string,
  profile: StudentProfile,
  modules: readonly Module[],
  rules: ProgrammeRules,
  exceptions: readonly ModuleException[] = [],
): RuleViolation[] {
  const module = modules.find((candidate) => candidate.id === moduleId);
  if (!module) return [unknownModule(moduleId)];
  const waived = exceptions.find((exception) => exception.moduleId === moduleId)?.waived ?? [];
  const isWaived = (violation: RuleViolation) =>
    waived.some((w) => w.code === violation.code && (w.prerequisiteId ?? null) === (violation.prerequisiteId ?? null));

  const violations: RuleViolation[] = checkProgrammeRules(module, rules);

  const completed = new Set(profile.completedModuleIds);
  for (const prerequisiteId of module.prerequisites.filter((id) => !completed.has(id))) {
    const prerequisite = modules.find((candidate) => candidate.id === prerequisiteId);
    const named = prerequisite ? `${prerequisiteId} (${prerequisite.title})` : prerequisiteId;
    violations.push({
      code: 'PREREQUISITE_MISSING',
      moduleId,
      prerequisiteId,
      message: `${moduleName(module)} requires ${named}, which is not among your completed modules.`,
    });
  }
  return violations.filter((violation) => !isWaived(violation));
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
 * I-Explore modules. `exceptions` waive only the per-module rules they name (see checkModuleEligibility):
 * an approved module's ECTS still count towards the cap and the totals.
 */
export function checkShortlist(
  shortlist: readonly string[],
  profile: StudentProfile,
  modules: readonly Module[],
  rules: ProgrammeRules,
  exceptions: readonly ModuleException[] = [],
): RulesResult {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const chosenIds = unique(shortlist);
  const violations = chosenIds.flatMap((id) => checkModuleEligibility(id, profile, modules, rules, exceptions));

  const plan = unique([...rules.coreModuleIds, ...chosenIds]).flatMap((id) => byId.get(id) ?? []);
  if (!rules.loaded) {
    // Without the year's rules there is no credit cap or requirement to check against, so none is made up.
    const warning: RuleWarning = {
      code: 'RULES_NOT_LOADED',
      message: `The ${rules.programme} rules for year ${rules.year} are not loaded, so ModuleMatch cannot check your plan's credit totals or requirements.`,
    };
    return { ok: violations.length === 0, violations, warnings: [warning, ...termImbalance(plan)] };
  }
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
