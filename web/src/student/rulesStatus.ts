// Issue 51: what the student sees when the rules for their programme and year are not loaded.
import type { ProgrammeInfo, RulesStatus } from '@modulematch/shared';

/** The catalogue count: how many modules are open, or that eligibility cannot be confirmed for the year. */
export function catalogueCount(total: number, eligible: number, rules: RulesStatus | undefined): string {
  if (rules && !rules.loaded) return `${total} modules · eligibility not confirmed for Year ${rules.year}`;
  return `${total} modules · ${eligible} open to you`;
}

/** Years of a programme that have no rules loaded, from GET /programmes. Unknown programmes have none. */
export function yearsWithoutRules(info: readonly ProgrammeInfo[] | undefined, programme: string): Set<number> {
  const entry = info?.find((p) => p.programme === programme);
  if (!entry) return new Set(info ? [1, 2, 3, 4] : []);
  return new Set(entry.years.filter((y) => !y.rulesLoaded).map((y) => y.year));
}

/** The second line on a year option whose rules are not loaded. */
export const NO_RULES_DETAIL = 'Rules not loaded yet';

/** The hint under the year dropdown when the chosen year has no rules. */
export const noRulesHint = (year: string) =>
  `ModuleMatch doesn't have the rules for Year ${year} yet, so it will rank modules but can't confirm which ones you can take.`;
