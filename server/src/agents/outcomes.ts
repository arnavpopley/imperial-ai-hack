// Questions that ask for a guaranteed outcome ("will this get me a job / a first?"). Spec 10.5: never promise
// grades, jobs or outcomes. The reply says so plainly first, then gives what the data can actually say: how
// relevant a module is to each career pathway, and its fit score. Deterministic, so live and offline agree (#67).
import type { Module, Pathway, Recommendation } from '@modulematch/shared';

/**
 * "Will taking X get me a job at Y?", "Is this module a guaranteed first?", "Can this help me get hired?".
 * It must be a question that asks whether something leads to an outcome, not just mention a job, a grade or
 * the word "guarantee" ("Add CFD; I know it does not guarantee a job" is a shortlist request).
 */
const GUARANTEE: RegExp[] = [
  /\bguarantee(s|d)?\b/i,
  /\b(will|would|does|do|can|could|is|are)\b.{0,60}\b(get|land|secure|earn|give|lead to|help me get|make me)\b.{0,30}\b(a job|jobs?|hired|employed|an? (internship|placement|offer)|a first|first[- ]class|a 2:1|top marks|good grades?|a good grade|a high grade|a distinction)\b/i,
  /\b(will|would|am) i\b.{0,30}\b(get|be) (a job|hired|employed|a first|a 2:1|a distinction)\b/i,
];

/**
 * A question: it ends with "?" or opens like one ("will…", "is…", "which…"), punctuation or not, so a remark
 * about guarantees is not one.
 */
const QUESTION = /\?\s*$|^\s*(will|would|does|do|did|can|could|is|are|am|should|which|what|how|why|who)\b/i;

export function asksForGuarantee(text: string): boolean {
  return QUESTION.test(text) && GUARANTEE.some((pattern) => pattern.test(text));
}

/** Said first, every time: no outcome is promised. */
export const NO_GUARANTEE = "I can't promise a job or a grade: no module guarantees an outcome, and nothing here predicts one.";

/** Pathways a module counts as relevant to, at or above this relevance (as in the pathway progress engine). */
const RELEVANT = 0.5;

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * The honest reply to a guarantee question. With a module named: its relevance to the career pathways (from
 * the module data) and its fit for the student when there is one. Without: where that information lives.
 */
export function guaranteeReply(module: Module | null, pathways: readonly Pathway[], rec: Recommendation | null, scored: boolean): string {
  if (!module) {
    return `${NO_GUARANTEE} What I can show you is how relevant each module is to the career pathways you pick, on the Pathways page, and how well modules fit what you have told me.`;
  }
  const title = (id: string) => pathways.find((p) => p.id === id)?.title ?? id;
  const relevant = Object.entries(module.pathwayRelevance)
    .filter(([, relevance]) => relevance >= RELEVANT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, relevance]) => `${title(id)} (${pct(relevance)})`);
  const relevance = relevant.length
    ? `From the module data, ${module.title} is most relevant to these career pathways: ${relevant.join(', ')}.`
    : `From the module data, ${module.title} is not strongly linked to any one career pathway.`;
  const fit = rec && scored ? ` Its fit for you is ${rec.fit} out of 100.` : '';
  return `${NO_GUARANTEE} ${relevance}${fit} The Pathways page shows how your shortlist builds towards a pathway.`;
}
