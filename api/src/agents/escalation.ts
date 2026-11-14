// Escalation drafting (spec 11.1): the agent drafts a summary, the student approves or edits it, and only
// then is the escalation created. Drafts never include redacted or sensitive text.
import type { EscalationDraft, EscalationType, Module, StudentProfile } from '@modulematch/shared';

export const QUEUE: Record<EscalationType, string> = {
  RULE_EXCEPTION: 'Senior Tutor',
  LOW_CONFIDENCE: 'Personal tutor',
  WELLBEING: 'Student support',
  COMPLAINT: 'Admin',
};

export function draftRuleException(profile: StudentProfile, module: Module, reasons: string[], request: string): EscalationDraft {
  return {
    type: 'RULE_EXCEPTION',
    summary:
      `${profile.programme}, Year ${profile.yearOfStudy}, asks to take ${module.code} ${module.title}. ` +
      `The advisor could not allow it: ${reasons.join(' ')} ` +
      `In the student's words: "${request.slice(0, 200)}"`,
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
