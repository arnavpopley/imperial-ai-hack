// Editable copy of an exam feedback form (spec 23), the request body it saves to, and the client-side
// preview of the tailored feedback a student would get from it.
import type { ExamFeedbackForm, ExamFormSaveBody, Module, TailoredFeedback } from '@modulematch/shared';
import { plural, topicLabel } from './format.ts';

/** The notes field accepts this many characters, matching ExamFormDraftBody. */
export const NOTES_LIMIT = 20000;

export interface QuestionDraft {
  /** Stable React key for the editor; never sent to the server. */
  key: string;
  label: string;
  /** Kept as typed so the field can be cleared while editing; parsed on save. */
  maxMarks: string;
  topics: string[];
  whatGoodAnswersDid: string;
  commonMistakes: string[];
  revisionPointers: string[];
}

export interface ExamDraft {
  examLabel: string;
  generalComments: string;
  questions: QuestionDraft[];
}

export type ExamStatus = 'unsaved' | 'draft' | 'ai-draft' | 'published';

export function examStatus(form: ExamFeedbackForm | null): ExamStatus {
  if (!form) return 'unsaved';
  if (form.status === 'published') return 'published';
  return form.authoredBy === 'ai-draft' ? 'ai-draft' : 'draft';
}

let keySeed = 0;
const nextKey = () => `question-${++keySeed}`;

/**
 * Student mark sheets refer to questions by number, so a question's id is its position on the paper:
 * Q1, Q2 and so on. Ids are re-derived on every save, which keeps them unique through reorders and deletes.
 */
export const questionId = (index: number) => `Q${index + 1}`;

/** The label shown for a question, falling back to its number when the examiner left it blank. */
export const questionTitle = (q: QuestionDraft, index: number) => q.label.trim() || `Question ${index + 1}`;

export function blankQuestion(): QuestionDraft {
  return {
    key: nextKey(),
    label: '',
    maxMarks: '',
    topics: [],
    whatGoodAnswersDid: '',
    commonMistakes: [''],
    revisionPointers: [''],
  };
}

export const blankDraft = (examLabel: string): ExamDraft => ({
  examLabel,
  generalComments: '',
  questions: [blankQuestion()],
});

export function draftFromForm(form: ExamFeedbackForm): ExamDraft {
  return {
    examLabel: form.examLabel,
    generalComments: form.generalComments,
    questions: form.questions.map((q) => ({
      key: nextKey(),
      label: q.label,
      maxMarks: String(q.maxMarks),
      topics: [...q.topics],
      whatGoodAnswersDid: q.whatGoodAnswersDid,
      commonMistakes: [...q.commonMistakes],
      revisionPointers: [...q.revisionPointers],
    })),
  };
}

/** True when two drafts would save the same form, ignoring editor keys and blank list rows. */
export function sameDraft(a: ExamDraft, b: ExamDraft): boolean {
  return JSON.stringify(saveBody(a)) === JSON.stringify(saveBody(b));
}

const cleanList = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

export const parseMarks = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw));

/** The PUT body: trimmed text, no blank list rows, and ids by position. */
export function saveBody(draft: ExamDraft): ExamFormSaveBody {
  return {
    examLabel: draft.examLabel.trim(),
    generalComments: draft.generalComments.trim(),
    questions: draft.questions.map((q, i) => ({
      id: questionId(i),
      label: questionTitle(q, i),
      maxMarks: parseMarks(q.maxMarks),
      topics: [...q.topics],
      whatGoodAnswersDid: q.whatGoodAnswersDid.trim(),
      commonMistakes: cleanList(q.commonMistakes),
      revisionPointers: cleanList(q.revisionPointers),
    })),
  };
}

export interface DraftIssue {
  /** Element id of the field to focus, built with fieldId. */
  field: string;
  message: string;
}

export const fieldId = (key: string, field: string) => `exam-${key}-${field}`;

export const EXAM_LABEL_FIELD = 'exam-label';

/** Problems that would make the server reject the form, in the order they appear on screen. */
export function draftIssues(draft: ExamDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!draft.examLabel.trim()) issues.push({ field: EXAM_LABEL_FIELD, message: 'Give the exam a name.' });
  draft.questions.forEach((q, i) => {
    const marks = parseMarks(q.maxMarks);
    if (!Number.isFinite(marks) || marks <= 0)
      issues.push({ field: fieldId(q.key, 'marks'), message: `${questionId(i)} needs a maximum mark above 0.` });
  });
  return issues;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export const totalMarks = (draft: ExamDraft) =>
  draft.questions.reduce((sum, q) => {
    const marks = parseMarks(q.maxMarks);
    return Number.isFinite(marks) && marks > 0 ? sum + marks : sum;
  }, 0);

// ---------- preview ----------

/** Share of the marks the sample student gets on the question they struggled with, and on the rest. */
const WEAK_SHARE = 0.35;
const STRONG_SHARE = 0.8;
/** A later module counts as building on a topic when it weights that topic at least this much (spec 23). */
const MAIN_TOPIC_WEIGHT = 0.5;
const MAX_AFFECTED = 3;

export interface SampleMark {
  questionId: string;
  label: string;
  mark: number;
  maxMarks: number;
  weak: boolean;
}

export interface FeedbackPreview {
  feedback: TailoredFeedback;
  marks: SampleMark[];
  /** The question the sample student lost marks on: the one asked for, or the first with marks set. */
  weakIndex: number;
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

const listTopics = (topics: readonly string[]) => topics.map(topicLabel).join(', ');

/**
 * Builds, in the browser, the template version of the tailored feedback a sample student would get after
 * losing marks on one question. It mirrors the offline template in spec 23 so staff can see the effect of
 * their form before publishing. The marks are invented; no real student's marks are involved.
 */
export function previewFeedback({
  draft,
  weakIndex,
  moduleId,
  catalogue,
}: {
  draft: ExamDraft;
  weakIndex: number;
  moduleId: string;
  catalogue: readonly Module[];
}): FeedbackPreview | null {
  const scored = draft.questions
    .map((q, i) => ({ q, i, max: parseMarks(q.maxMarks) }))
    .filter(({ max }) => Number.isFinite(max) && max > 0);
  if (scored.length === 0) return null;
  const weak = scored.find(({ i }) => i === weakIndex) ?? scored[0]!;

  const marks: SampleMark[] = scored.map(({ q, i, max }) => ({
    questionId: questionId(i),
    label: questionTitle(q, i),
    mark: roundHalf(max * (i === weak.i ? WEAK_SHARE : STRONG_SHARE)),
    maxMarks: max,
    weak: i === weak.i,
  }));
  const weakMark = marks.find((m) => m.weak)!;
  const lostMarks = weakMark.maxMarks - weakMark.mark;
  const total = marks.reduce((s, m) => s + m.mark, 0);
  const outOf = marks.reduce((s, m) => s + m.maxMarks, 0);
  const weakTopics = weak.q.topics;

  const mistakes = cleanList(weak.q.commonMistakes);
  const pointers = cleanList(weak.q.revisionPointers);
  const adviceParts = [
    mistakes.length > 0 && `The examiner saw these mistakes most often: ${mistakes.map(lowerInitial).join('; ')}.`,
    weak.q.whatGoodAnswersDid.trim() && `Good answers ${lowerFirst(weak.q.whatGoodAnswersDid.trim())}`,
  ].filter(Boolean);

  const strengths = scored
    .filter(({ i }) => i !== weak.i)
    .slice(0, 2)
    .map(({ q, i }) => {
      const m = marks.find((x) => x.questionId === questionId(i))!;
      const on = q.topics.length > 0 ? ` on ${listTopics(q.topics).toLowerCase()}` : '';
      return `${questionId(i)}${on}: ${m.mark} of ${m.maxMarks}.`;
    });

  const revisionPlan = [
    ...pointers,
    ...weakTopics.slice(0, 2).map((t) => `Try a past-paper question on ${topicLabel(t).toLowerCase()} under timed conditions.`),
  ];
  if (revisionPlan.length === 0) revisionPlan.push(`Rework ${weakMark.questionId} from the model answer, then try it again unseen.`);

  return {
    marks,
    weakIndex: weak.i,
    feedback: {
      moduleId,
      examLabel: draft.examLabel.trim() || 'This exam',
      overall: `You scored ${total} of ${outOf}. Most of the marks you lost were on ${weakMark.questionId}${
        weakTopics.length > 0 ? ` (${listTopics(weakTopics).toLowerCase()})` : ''
      }, so that is the best place to start.`,
      strengths,
      weakPoints: [
        {
          questionId: weakMark.questionId,
          topics: weakTopics,
          lostMarks,
          advice: adviceParts.join(' ') || 'The examiner has not added mistakes or pointers for this question yet.',
        },
      ],
      revisionPlan,
      affectsModules: affectedModules(moduleId, weakTopics, catalogue),
      source: 'template',
    },
  };
}

/** Lower-cases a leading capital unless the next letter is a capital too, so acronyms such as "CFD" survive. */
function lowerInitial(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function lowerFirst(text: string): string {
  const sentence = /[.!?]$/.test(text) ? text : `${text}.`;
  return lowerInitial(sentence);
}

/** Later modules that list this one as a prerequisite or weight a weak topic as a main topic. */
export function affectedModules(
  moduleId: string,
  topics: readonly string[],
  catalogue: readonly Module[],
): TailoredFeedback['affectsModules'] {
  return catalogue
    .filter((m) => m.id !== moduleId)
    .map((m) => {
      const shared = topics.filter((t) => (m.topics[t] ?? 0) >= MAIN_TOPIC_WEIGHT);
      const prereq = m.prerequisites.includes(moduleId);
      const score = (prereq ? 2 : 0) + shared.reduce((s, t) => s + (m.topics[t] ?? 0), 0);
      return { m, shared, prereq, score };
    })
    .filter(({ shared, prereq }) => prereq || shared.length > 0)
    .sort((a, b) => b.score - a.score || a.m.code.localeCompare(b.m.code))
    .slice(0, MAX_AFFECTED)
    .map(({ m, shared, prereq }) => ({
      moduleId: m.id,
      note: prereq
        ? `${m.code} ${m.title} lists this module as a prerequisite.`
        : `${m.code} ${m.title} builds on ${listTopics(shared).toLowerCase()}.`,
    }));
}

// ---------- example notes ----------

/**
 * Synthetic marking notes for the demo, written around the module's own main topics so the AI draft has
 * something realistic to work from. Labelled as synthetic wherever it is offered.
 */
export function exampleNotes(module: Pick<Module, 'title' | 'topics'> | undefined): string {
  const topics = Object.entries(module?.topics ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([t]) => topicLabel(t).toLowerCase());
  while (topics.length < 3) topics.push(['core theory', 'worked problems', 'applications'][topics.length]!);
  const [a, b, c] = topics as [string, string, string];
  return [
    `Synthetic marking notes for the ${module?.title ?? 'module'} exam.`,
    '',
    `Q1 (20 marks), ${a}. Best answers stated their assumptions before starting and checked units at the end. Common mistakes: skipped the assumptions, sign errors in the second part. Revise the derivation in lecture 3 and problem sheet 2.`,
    '',
    `Q2 (30 marks), ${b}. Weakest question overall. Strong scripts sketched the set-up first and justified each step. Common mistakes: applied the formula outside its range of validity, no sketch, gave up after part (b). Pointers: worked examples 4.2 to 4.5, and the 2024 paper Q3.`,
    '',
    `Q3 (25 marks), ${c}. Mostly well done. Good answers linked the result back to the physical system. Common mistake: numerical answer with no interpretation. Revise the case study in week 8.`,
    '',
    'General: time management was an issue, as many scripts left the last part blank. Show working, since method marks are generous.',
  ].join('\n');
}

export const describeQuestions = (draft: ExamDraft) =>
  `${plural(draft.questions.length, 'question')}, ${plural(totalMarks(draft), 'mark')}`;
