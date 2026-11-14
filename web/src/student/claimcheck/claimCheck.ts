// Builds a short checking plan for a piece of AI-written content on the module page: one place it could be
// wrong, one thing to check and where to check it. The idea comes from the "AI Claim Checker" skill by Gareth
// Manning (CC BY-SA 4.0, see .claude/skills/ai-claim-checker/NOTICE.md); this code is ModuleMatch's own.
// It is deterministic and offline: plain rules over the text already on the page, with no model call.
import type { Explanation } from '@modulematch/shared';

/** What kind of AI-written content is being checked. */
export type ClaimKind =
  /** The "In short" summary written live by a model from the public description. */
  | 'summary'
  /** The "In short" summary built offline from the module record by a template. */
  | 'summary-template'
  /** The "Why it fits you" explanation of the fit score. */
  | 'fit'
  /** An answer from the "Ask about this module" chat. */
  | 'answer';

export interface ClaimCheckInput {
  kind: ClaimKind;
  /** The content as shown, so the thing to check can be picked from what it mentions. */
  text: string;
  /** The module's public page (`Module.sourceUrl`). */
  sourceUrl: string;
  /** Who derived the module's tags; staff-edited tags have been reviewed by a person. Only used for `fit`. */
  derivedBy?: 'analyst-agent' | 'staff-edit';
}

export interface ClaimSource {
  label: string;
  /** A link when the source is a page; absent for a person to ask. */
  href?: string;
  note: string;
}

export interface ClaimCheckPlan {
  couldBeWrong: string;
  check: { label: string; how: string };
  sources: ClaimSource[];
}

interface Topic {
  id: string;
  pattern: RegExp;
  label: string;
  how: string;
  /** A person can confirm this better than any page, so the plan suggests asking the module lead. */
  askLead: boolean;
}

/** In priority order: the first topic the text mentions becomes the one thing to check. */
const TOPICS: readonly Topic[] = [
  {
    id: 'assessment',
    pattern: /\b(assess\w*|exams?|examinations?|coursework|weight\w*|grades?|graded|marks?|quiz\w*|tests?)\b|%/i,
    label: 'The assessment weightings',
    how: 'Compare each assessment item and its percentage with the public module page. Weightings can change between years.',
    askLead: true,
  },
  {
    id: 'prerequisites',
    pattern: /\b(prerequisites?|pre-requisites?|beforehand|prior|requires?|required|background|need to know)\b/i,
    label: 'The prerequisites',
    how: 'Check the listed prerequisites on the public module page against the modules you have completed.',
    askLead: true,
  },
  {
    id: 'capacity',
    pattern: /\b(capacity|places|cap|capped|oversubscribed|ballot)\b/i,
    label: 'How many places there are',
    how: 'Check the capacity and how places are allocated, as this can change each year.',
    askLead: true,
  },
  {
    id: 'timing',
    pattern: /\b(terms?|autumn|spring|summer|timetabled?|lectures?|schedule\w*|weekly|labs?|tutorials?)\b/i,
    label: 'When it runs',
    how: 'Check the term and the teaching times against the public page and the published timetable.',
    askLead: false,
  },
  {
    id: 'workload',
    pattern: /\b(workload|hours|ects|credits?|independent study)\b/i,
    label: 'The credits and workload',
    how: 'Check the ECTS value and the expected study hours on the public module page.',
    askLead: false,
  },
  {
    id: 'content',
    pattern: /\b(outcomes?|covers?|covered|topics?|projects?|build|builds|syllabus|content)\b/i,
    label: 'What the module covers',
    how: 'Read the learning outcomes on the public page and see whether they match what this says the module covers.',
    askLead: false,
  },
];

/** Used when the text mentions none of the topics above. */
const DEFAULT_CHECK: Record<ClaimKind, ClaimCheckPlan['check']> = {
  summary: {
    label: 'One highlight',
    how: 'Pick one highlight above and find the sentence in the public description that supports it.',
  },
  'summary-template': {
    label: 'One highlight',
    how: 'Pick one highlight above and find it in the public description, in case the record is out of date.',
  },
  fit: {
    label: 'The reason that matters most to you',
    how: 'Open that reason above to see its source, then check the module side against the public module page.',
  },
  answer: {
    label: 'The detail you would rely on',
    how: 'Find the part of this answer you would base a decision on and look for it on the public module page.',
  },
};

function couldBeWrong(kind: ClaimKind, derivedBy: ClaimCheckInput['derivedBy']): string {
  switch (kind) {
    case 'summary':
      return 'AI wrote this summary from the public description. Shortening it may leave out details or make something sound more certain than the original does.';
    case 'summary-template':
      return 'This summary was put together automatically from the module record. It leaves details out, and the record may be older than the public page.';
    case 'fit':
      return derivedBy === 'staff-edit'
        ? 'Code works out the fit score from your interview answers and the module’s tags. Staff have reviewed these tags, but a tag can still miss what the module is like in practice, and that would change the score.'
        : 'Code works out the fit score from your interview answers and the module’s tags. AI derived the tags (topics, skills, maths and coding load) from the description. If a tag is wrong, the score and the reasons are wrong too.';
    case 'answer':
      return 'This answer only uses what this module’s record and public description contain. Anything they leave out, or anything that has changed this year, will be missing or out of date here.';
  }
}

/** Builds the checking plan for one piece of content. The same input always gives the same plan. */
export function buildClaimCheck({ kind, text, sourceUrl, derivedBy }: ClaimCheckInput): ClaimCheckPlan {
  const topic = TOPICS.find((t) => t.pattern.test(text));
  const sources: ClaimSource[] = [
    { label: 'Public module page', href: sourceUrl, note: 'The department’s own description, outside ModuleMatch.' },
  ];
  if (kind === 'answer' || topic?.askLead) {
    sources.push({
      label: 'Ask the module lead',
      note: 'For anything your choice depends on, the module lead or your department office can confirm it for this year.',
    });
  }
  return {
    couldBeWrong: couldBeWrong(kind, derivedBy),
    check: topic ? { label: topic.label, how: topic.how } : DEFAULT_CHECK[kind],
    sources,
  };
}

/** All the text of a fit explanation (summary, reasons and watch-outs), for `buildClaimCheck`. */
export function explanationText(explanation: Explanation): string {
  return [explanation.summary, ...explanation.because.map((r) => r.text), ...explanation.watchOuts].join('\n');
}
