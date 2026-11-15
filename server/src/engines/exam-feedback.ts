// Exam feedback facts (spec 23): computed by code from a published examiner form and the student's own question
// marks. The tailored-feedback agent words these facts; the offline template builds feedback from them directly.
import type { ExamFeedbackForm, Module, ModuleResult, TailoredFeedback } from '@modulematch/shared';
import { MAIN_TOPIC_MIN } from './performance.ts';
import { compareIds, roundTo, topicLabel, unique } from './util.ts';

/** A question is weak below this share of its marks; at most MAX_WEAK are reported, most marks lost first. */
export const WEAK_SHARE = 0.6;
export const STRONG_SHARE = 0.75;
const MAX_WEAK = 3;
const MAX_STRONG = 3;
const MAX_AFFECTED = 5;

export interface QuestionFact {
  questionId: string;
  label: string;
  topics: string[];
  mark: number;
  maxMarks: number;
  lostMarks: number;
  share: number;
}

export interface WeakQuestionFact extends QuestionFact {
  whatGoodAnswersDid: string;
  commonMistakes: string[];
  revisionPointers: string[];
}

export interface AffectedModuleFact {
  moduleId: string;
  title: string;
  reason: 'prerequisite' | 'topic';
  topics: string[];
}

export interface ExamFacts {
  moduleId: string;
  moduleTitle: string;
  examLabel: string;
  mark: number;
  questions: QuestionFact[];
  weak: WeakQuestionFact[];
  strong: QuestionFact[];
  generalComments: string;
  affects: AffectedModuleFact[];
}

const sameId = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Facts for one exam, or null when the student has no question marks matching the form's questions.
 * `exclude` lists modules that are never suggested as affected (taken or completed ones).
 */
export function examFacts(form: ExamFeedbackForm, result: ModuleResult, modules: Module[], exclude: string[] = []): ExamFacts | null {
  const questions: QuestionFact[] = form.questions.flatMap((q) => {
    const got = result.questionMarks.find((m) => sameId(m.questionId, q.id));
    if (!got) return [];
    const share = got.maxMarks > 0 ? got.mark / got.maxMarks : 0;
    return [{ questionId: q.id, label: q.label, topics: q.topics, mark: got.mark, maxMarks: got.maxMarks, lostMarks: roundTo(got.maxMarks - got.mark, 1), share: roundTo(share, 3) }];
  });
  if (questions.length === 0) return null;
  const byLoss = [...questions].sort((a, b) => b.lostMarks - a.lostMarks || a.share - b.share || compareIds(a.questionId, b.questionId));
  let weakList = byLoss.filter((q) => q.share < WEAK_SHARE).slice(0, MAX_WEAK);
  // With no clearly weak question, the lowest one is still worth a pointer unless the paper went well throughout.
  if (weakList.length === 0 && byLoss[0] && byLoss[0].share < 0.8) weakList = [byLoss[0]];
  const weak: WeakQuestionFact[] = weakList.map((q) => {
    const source = form.questions.find((f) => f.id === q.questionId)!;
    return { ...q, whatGoodAnswersDid: source.whatGoodAnswersDid, commonMistakes: source.commonMistakes, revisionPointers: source.revisionPointers };
  });
  const strong = [...questions]
    .filter((q) => q.share >= STRONG_SHARE)
    .sort((a, b) => b.share - a.share || compareIds(a.questionId, b.questionId))
    .slice(0, MAX_STRONG);

  // A question's first topic is its main one; matching on it alone keeps broad topics (maths) from pulling in every module.
  const weakTopics = unique(weak.flatMap((q) => q.topics.slice(0, 1)));
  const skip = new Set([...exclude, form.moduleId]);
  // Only modules taught later than the exam's own can build on it (issue #109); earlier years are behind the student.
  const examLevel = modules.find((m) => m.id === form.moduleId)?.level;
  const affects = modules
    .filter((m) => !skip.has(m.id) && (examLevel === undefined || m.level > examLevel))
    .flatMap((m) => {
      const overlap = weakTopics.filter((t) => (m.topics[t] ?? 0) >= MAIN_TOPIC_MIN);
      const prerequisite = m.prerequisites.includes(form.moduleId);
      if (!prerequisite && overlap.length === 0) return [];
      const weight = overlap.reduce((s, t) => s + (m.topics[t] ?? 0), 0);
      return [{ fact: { moduleId: m.id, title: m.title, reason: prerequisite ? ('prerequisite' as const) : ('topic' as const), topics: overlap }, prerequisite, weight }];
    })
    .sort((a, b) => Number(b.prerequisite) - Number(a.prerequisite) || b.weight - a.weight || compareIds(a.fact.moduleId, b.fact.moduleId))
    .slice(0, MAX_AFFECTED)
    .map((a) => a.fact);

  const moduleTitle = modules.find((m) => m.id === form.moduleId)?.title ?? result.title ?? form.moduleId;
  return { moduleId: form.moduleId, moduleTitle, examLabel: form.examLabel, mark: result.mark, questions, weak, strong, generalComments: form.generalComments, affects };
}

const topicList = (topics: string[]) => {
  const labels = topics.map((t) => topicLabel(t).toLowerCase());
  return labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
};

const sentence = (s: string) => {
  const t = s.trim();
  return !t ? '' : /[.!?]$/.test(t) ? t : `${t}.`;
};

/** Default note on a module the weak topics lead into. */
export function affectedNote(a: AffectedModuleFact, examModuleTitle: string): string {
  if (a.reason === 'prerequisite') return `${a.title} lists ${examModuleTitle} as a prerequisite, so this revision pays off there too.`;
  return `${a.title} builds on ${topicList(a.topics)}, so it is worth having that secure before you start.`;
}

/** A question's label without its "Q3:" prefix, for use inside a sentence. */
const subject = (q: QuestionFact) => q.label.replace(/^Q\w*\s*[:.)-]\s*/i, '').trim() || q.label;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Default advice for one weak question: the examiner's common mistakes and what good answers did. The marks lost
 * are shown in the student's chart, so the advice does not repeat them.
 */
export function weakAdvice(q: WeakQuestionFact): string {
  const parts: string[] = [];
  if (q.commonMistakes.length) {
    parts.push(`Common mistakes the examiners saw: ${q.commonMistakes.slice(0, 2).map((m) => lowerFirst(m.trim().replace(/\.$/, ''))).join('; ')}.`);
  }
  const good = q.whatGoodAnswersDid.trim();
  // The field holds what good answers did ("Drew a diagram."), so it reads on from "Good answers".
  if (good) parts.push(/^(good|best|strong)/i.test(good) ? sentence(good) : `Good answers ${lowerFirst(sentence(good))}`);
  if (parts.length === 0) parts.push(`Work through ${lowerFirst(subject(q))} again with the examiners' pointers in your plan.`);
  return parts.join(' ');
}

/** A question's subject, for the chart and the weak-point headings. */
export const questionSubject = subject;

/** Offline feedback built only from the facts (spec 23). */
export function templateFeedback(f: ExamFacts): TailoredFeedback {
  const names = f.weak.map((q) => `${q.questionId} (${subject(q)})`);
  const weakNames = names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  // One sentence, said once: the mark and the per-question numbers are in the chart beside it.
  const overall = f.weak.length
    ? `Most marks went on ${weakNames}.`
    : `A strong paper all round; the examiners' general comments are a good guide to the last few marks.`;
  const plan = unique([
    ...f.weak.flatMap((q) => q.revisionPointers.slice(0, 2).map(sentence)),
    ...f.weak.slice(0, 2).map((q) => `Re-attempt ${q.questionId} under timed conditions, then compare your answer with what good answers did.`),
  ]).slice(0, 5);
  return {
    moduleId: f.moduleId,
    examLabel: f.examLabel,
    mark: f.mark,
    questions: f.questions.map((q) => ({ questionId: q.questionId, label: subject(q), mark: q.mark, maxMarks: q.maxMarks })),
    overall,
    // The topic only: the marks are in the chart, and the same praise on every strong answer said nothing.
    strengths: f.strong.map((q) => `${q.questionId} ${subject(q)}`),
    weakPoints: f.weak.map((q) => ({ questionId: q.questionId, label: subject(q), topics: q.topics, lostMarks: q.lostMarks, advice: weakAdvice(q) })),
    revisionPlan: plan,
    affectsModules: f.affects.map((a) => ({ moduleId: a.moduleId, note: affectedNote(a, f.moduleTitle) })),
    source: 'template',
  };
}
