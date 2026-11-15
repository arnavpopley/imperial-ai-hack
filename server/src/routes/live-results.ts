// The latest live-model evaluation (`npm run eval:live`, spec 18), read-only, for the "How it works" page. The run
// costs money, so it is committed as data/eval-live-latest.json and never re-run on a deploy; this serves that file.
import { schemas } from '@modulematch/shared';
import { existsSync, readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { z } from 'zod';
import { moduleTitle } from '../agents/session.ts';
import { dataPath } from '../db/datasets.ts';

export const LIVE_EVAL_FILE = 'eval-live-latest.json';

/** The model IDs a live run used. Runs written before the script recorded them have none. */
export const LiveEvalModels = z.object({ smart: z.string(), fast: z.string(), light: z.string(), judge: z.string() });
export const LiveEvalRun = schemas.EvalRun.extend({ models: LiveEvalModels.optional() });
export type LiveEvalRun = z.infer<typeof LiveEvalRun>;

/** The latest live run, or null when none has been committed. Read on each request so a new run shows at once. */
export function latestLiveEval(file = dataPath(LIVE_EVAL_FILE)): LiveEvalRun | null {
  if (!existsSync(file)) return null;
  return LiveEvalRun.parse(JSON.parse(readFileSync(file, 'utf8')));
}

// ---------- presenting a miss to the audience (issue #115) ----------

const MODULE_ID = /\b(?:[A-Z]{3,5}\d{5}|IEX-[A-Z]+)\b/g;
const words = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ').toLowerCase();
/** Profile slot keys in a case name, in words: "interest:fluid-mechanics" -> "interest in fluid mechanics". */
const slotWords = (text: string) =>
  text
    .replace(/\binterest:([a-z-]+)/g, (_, topic: string) => `interest in ${words(topic)}`)
    .replace(/\bstyle\.([A-Za-z]+)/g, (_, key: string) => words(key))
    .replace(/: pathways$/, ': career pathways');

/** A human title for a test case: module codes become titles, slot keys become words, the first letter a capital. */
export function missTitle(caseName: string, titleOf: (id: string) => string = moduleTitle): string {
  const named = slotWords(caseName.replace(MODULE_ID, (id) => titleOf(id)));
  const facts = /^(.+) assessment$/.exec(named);
  const text = facts ? `${facts[1]}: how it is assessed` : named;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Longest reason line; a longer one is cut at a clause or word boundary, and the full text stays behind "Details". */
const REASON_MAX = 160;

/** One plain-English line for why a case failed, from the judge's or checker's note. */
export function missReason(note: string): string {
  const missing = /^missing (.+?): /.exec(note);
  if (missing) return `The answer left out "${missing[1]}", which the published record states.`;
  if (note === 'template answer, not a live result') return 'The model did not answer, so the template stood in; that never counts as a live pass.';
  const sentence = (note.split(/(?<=[.!?])\s+/)[0] ?? note).trim();
  if (sentence.length <= REASON_MAX) return sentence;
  const head = sentence.slice(0, REASON_MAX);
  const clause = Math.max(head.indexOf(' ('), head.lastIndexOf('; '));
  if (clause > 60) return `${head.slice(0, clause).replace(/[,:]$/, '')}.`;
  return `${head.slice(0, head.lastIndexOf(' '))}…`;
}

/** The run as the page shows it: each failing case also carries a title and a one-line reason. */
export function presentLiveEval(run: LiveEvalRun, titleOf: (id: string) => string = moduleTitle) {
  return {
    ...run,
    results: run.results.map((r) => ({
      ...r,
      details: r.details.map((d) => (d.pass ? d : { ...d, title: missTitle(d.case, titleOf), reason: missReason(d.note ?? '') })),
    })),
  };
}

export const liveEvalRoutes = new Hono().get('/live', (c) => {
  const run = latestLiveEval();
  return c.json(run && presentLiveEval(run));
});
