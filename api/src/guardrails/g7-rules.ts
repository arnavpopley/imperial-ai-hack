// G7 rules validation (spec 11): no suggestion may break programme rules. Ineligible module suggestions are
// replaced, and the student is offered an escalation instead.
import type { Recommendation } from '@modulematch/shared';

export const RULES_NOTICE =
  'Some options are not open to you under your programme rules, so I left them out. ' +
  'If you think you should be allowed an exception, I can draft a request to the Senior Tutor.';

export function keepEligible(moduleIds: string[], ranked: Recommendation[]): { kept: string[]; removed: string[] } {
  const eligible = new Set(ranked.filter((r) => r.eligible).map((r) => r.moduleId));
  return {
    kept: moduleIds.filter((id) => eligible.has(id)),
    removed: moduleIds.filter((id) => !eligible.has(id)),
  };
}
