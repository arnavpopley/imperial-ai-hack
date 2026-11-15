// The Senior Tutor's view of a rule-exception request: the broken rule as data, and the reply each action sends.
import { schemas } from '@modulematch/shared';
import type { ExceptionDecision, ExceptionRequest, RuleViolation } from '@modulematch/shared';
import type { z } from 'zod';
import { percent } from './format.ts';

export const MAX_REPLY = schemas.ESCALATION_REPLY_MAX;

/** Plain names for the rules-engine codes (spec 9.1). */
export const RULE_LABELS: Record<RuleViolation['code'], string> = {
  PREREQUISITE_MISSING: 'Prerequisite not completed',
  NOT_ALLOWED: 'Not open to the programme',
  ECTS_CAP_EXCEEDED: 'Over the credit cap',
  ELECTIVE_ECTS_SHORT: 'Elective credits short',
  I_EXPLORE_MISSING: 'No I-Explore module',
  UNKNOWN_MODULE: 'Not in the catalogue',
};

export interface RuleRow {
  code: RuleViolation['code'];
  label: string;
  /** The module the rule applies to, and for a missing prerequisite the module that is missing. */
  moduleId: string | null;
  prerequisiteId: string | null;
  detail: string;
}

export const ruleRows = (violations: readonly RuleViolation[]): RuleRow[] =>
  violations.map((v) => ({
    code: v.code,
    label: RULE_LABELS[v.code],
    moduleId: v.moduleId,
    prerequisiteId: v.prerequisiteId ?? null,
    detail: v.message,
  }));

/** Approve or decline a rule exception, or (for every other case) send a written reply. */
export type StaffAction = 'approve' | 'decline' | 'reply';

type RespondInput = z.input<typeof schemas.EscalationRespondBody>;

/** The respond body for an action. A plain reply needs text; a decision's message is optional. Null means not ready. */
export function respondBody(action: StaffAction, message: string): RespondInput | null {
  const text = message.trim();
  if (action === 'reply') return text ? { response: text, resolve: true } : null;
  return { decision: action, response: text, resolve: true };
}

/**
 * Whether approving opens the module: only rules broken by the module itself (not open to the programme, or a
 * missing prerequisite) can be waived. Shortlist rules such as the credit cap are never waived.
 */
export function approvalOpensModule(request: ExceptionRequest | null): boolean {
  const moduleId = request?.moduleId;
  return Boolean(
    moduleId &&
      request.violations.some(
        (v) => v.moduleId === moduleId && (v.code === 'NOT_ALLOWED' || (v.code === 'PREREQUISITE_MISSING' && v.prerequisiteId)),
      ),
  );
}

export const DECISION_LABELS: Record<ExceptionDecision, string> = {
  approved: 'Exception approved',
  declined: 'Exception declined',
};

/** The fit's sub-scores in one line. The goal score is left out when the student chose no pathway. */
export function subScoreText(sub: NonNullable<ExceptionRequest['fit']>['sub']): string {
  return [
    `interest ${percent(sub.interest)}`,
    ...(sub.goal === null ? [] : [`goals ${percent(sub.goal)}`]),
    `style ${percent(sub.style)}`,
    `breadth ${percent(sub.breadth)}`,
  ].join(' · ');
}
