// Escalation drafting (spec 11.1): the agent drafts a summary, the student approves or edits it, and only
// then is the escalation created. Drafts never include redacted or sensitive text. Drafts are written for the
// member of staff who reads them, so they speak about the student in the third person.
import {
  schemas,
  type EscalationDraft,
  type EscalationType,
  type ExceptionRequest,
  type Module,
  type ModuleException,
  type Recommendation,
  type RuleViolation,
  type RuleWaiver,
  type SessionState,
  type StudentProfile,
} from '@modulematch/shared';

export const QUEUE: Record<EscalationType, string> = {
  RULE_EXCEPTION: 'Senior Tutor',
  LOW_CONFIDENCE: 'Personal tutor',
  WELLBEING: 'Student support',
  COMPLAINT: 'Admin',
};

/** Advice the rules engine gives the student ("Remove at least…", "You can choose…"), which a tutor does not need. */
const ADVICE = /^(You can|Remove|Add|Consider)\b/;

/**
 * Rewrites a rules-engine message, which is addressed to the student, for staff: "your" becomes "the student's",
 * and sentences of advice to the student are dropped.
 */
export function thirdPerson(message: string): string {
  return message
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !ADVICE.test(sentence))
    .join(' ')
    .replace(/\bYour\b/g, "The student's")
    .replace(/\byour\b/g, "the student's")
    .replace(/\bYou\b/g, 'The student')
    .replace(/\byou\b/g, 'the student');
}

/** A suggested one-line reason, when the student already gave one ("…because I did control on placement"). */
export function reasonFrom(request: string): string {
  const clause = /\b(?:because|since)\b\s*([^\n]+)/i.exec(request)?.[1]?.trim().replace(/[?.!\s]+$/, '');
  if (!clause) return '';
  const line = `${clause[0]!.toUpperCase()}${clause.slice(1)}.`;
  return line.slice(0, schemas.EXCEPTION_REASON_MAX);
}

/** A rule-exception request, for one ineligible module or for a shortlist rule such as the credit cap. */
export function draftRuleException(
  profile: StudentProfile,
  violations: readonly RuleViolation[],
  request: string,
  module?: Module,
): EscalationDraft {
  const asks = module ? `The student asks to take ${module.code} ${module.title}` : 'The student asks for an exception to a programme rule';
  const rules = violations.map((v) => thirdPerson(v.message)).join(' ');
  return {
    type: 'RULE_EXCEPTION',
    summary:
      `${profile.programme}, Year ${profile.yearOfStudy}. ${asks}. ${violations.length > 1 ? 'Programme rules' : 'Programme rule'}: ${rules} ` +
      "The advisor cannot make exceptions, so this needs the Senior Tutor's decision.",
    moduleId: module?.id ?? null,
    violations: [...violations],
    reason: reasonFrom(request),
  };
}

export function draftLowConfidence(profile: StudentProfile, why: string): EscalationDraft {
  return {
    type: 'LOW_CONFIDENCE',
    summary: `${profile.programme}, Year ${profile.yearOfStudy}. The advisor is not confident in its recommendations: ${why} A conversation with a personal tutor may help.`,
  };
}

/** Wellbeing drafts carry no detail of what was said; support staff simply get in touch (spec 20.6). */
export function draftWellbeing(profile: StudentProfile): EscalationDraft {
  return {
    type: 'WELLBEING',
    summary: `${profile.programme}, Year ${profile.yearOfStudy}. The student would like someone from student support to get in touch.`,
  };
}

export function draftComplaint(profile: StudentProfile, complaint: string): EscalationDraft {
  return { type: 'COMPLAINT', summary: `${profile.programme}, Year ${profile.yearOfStudy}. Complaint: "${complaint.slice(0, 300)}"` };
}

/**
 * What a rule-exception escalation shares with the Senior Tutor, fixed when the student sends it. The broken rules
 * come from the server's own draft or from the rules engine, never from the request body, and are worded for staff.
 * `violationsFor` checks one module against the programme rules as they stand (no exceptions applied).
 */
export function exceptionRequest(
  session: SessionState,
  input: { moduleId: string | null; reason: string | undefined },
  violationsFor: (moduleId: string) => RuleViolation[],
  rec: Recommendation | undefined,
): ExceptionRequest {
  const draft = session.escalationDraft?.type === 'RULE_EXCEPTION' ? session.escalationDraft : null;
  const fromDraft = draft && (draft.moduleId ?? null) === input.moduleId ? draft : null;
  const violations = fromDraft?.violations ?? (input.moduleId ? violationsFor(input.moduleId) : []);
  return {
    moduleId: input.moduleId,
    violations: violations.map((v) => ({ ...v, message: thirdPerson(v.message) })),
    reason: input.reason ?? fromDraft?.reason ?? '',
    completedModuleIds: [...session.profile.completedModuleIds],
    fit: rec ? { fit: rec.fit, sub: rec.sub } : null,
  };
}

/**
 * The rule exception an approval grants: exactly the module-level rules the request showed as broken for its
 * module (the programme check, or each missing prerequisite). Null when there is nothing to waive, for example a
 * credit-cap request, because shortlist rules are never waived.
 */
export function exceptionFor(request: ExceptionRequest | null): ModuleException | null {
  const moduleId = request?.moduleId;
  if (!request || !moduleId) return null;
  const waived = request.violations.flatMap((v): RuleWaiver[] => {
    if (v.moduleId !== moduleId) return [];
    if (v.code === 'NOT_ALLOWED') return [{ code: v.code }];
    if (v.code === 'PREREQUISITE_MISSING' && v.prerequisiteId) return [{ code: v.code, prerequisiteId: v.prerequisiteId }];
    return [];
  });
  return waived.length > 0 ? { moduleId, waived } : null;
}

/**
 * The reply the student sees for a Senior Tutor decision, followed by the tutor's optional message. An approval only
 * promises the module when it waived a rule (`exception`); otherwise it says the plan is unchanged.
 */
export function decisionReply(
  decision: 'approve' | 'decline',
  module: Module | undefined,
  exception: ModuleException | null,
  message: string,
): string {
  const named = module ? `${module.code} ${module.title}` : null;
  const lead =
    decision === 'approve'
      ? exception && named
        ? `Exception approved: you can now take ${named}, and add it to your shortlist. Its credits still count towards your credit cap.`
        : 'Exception approved, but it waives no programme rule: the credit cap and the other plan rules always apply, so your plan is unchanged.'
      : named
        ? `Exception declined: the programme rule still applies, so ${named} stays unavailable.`
        : 'Exception declined: the programme rule still applies.';
  return message ? `${lead} ${message}` : lead;
}
