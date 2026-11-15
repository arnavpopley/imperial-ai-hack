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
/** Profile slots whose key does not read well as words. */
const SLOT_WORDS: Record<string, string> = {
  pathways: 'career pathways',
  pathwaysSkipped: 'skipped career pathways',
  breadthAppetite: 'appetite for breadth',
  'timetablePrefs.avoidDays': 'days to keep free',
  'timetablePrefs.avoidHalfDays': 'half-days to keep free',
  'timetablePrefs.earliestStart': 'earliest start time',
};
/** A profile slot key as the extraction cases name it. */
const SLOT = /^(interest:[a-z-]+|style\.[A-Za-z]+|timetablePrefs\.[A-Za-z]+|pathways|pathwaysSkipped|breadthAppetite)$/;

/** A profile slot in words: "interest:fluid-mechanics" -> "interest in fluid mechanics". */
function slotLabel(slot: string): string {
  if (SLOT_WORDS[slot]) return SLOT_WORDS[slot];
  if (slot.startsWith('interest:')) return `interest in ${words(slot.slice('interest:'.length))}`;
  return words(slot.slice(slot.indexOf('.') + 1));
}

/** An extraction case, "<persona>: <slot>" or "<persona>: no <slot>", with the slot in words. */
function slotWords(text: string): string {
  const cut = text.lastIndexOf(': ');
  if (cut < 0) return text;
  const tail = text.slice(cut + 2);
  const absent = tail.startsWith('no ');
  const slot = absent ? tail.slice(3) : tail;
  if (!SLOT.test(slot)) return text;
  return `${text.slice(0, cut)}: ${absent ? `no ${slotLabel(slot)} recorded` : slotLabel(slot)}`;
}

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
  const checks = failedChecks(note);
  if (checks) return checksReason(checks);
  if (note === 'template answer, not a live result') return 'The model did not answer, so the template stood in; that never counts as a live pass.';
  const sentence = (note.split(/(?<=[.!?])\s+/)[0] ?? note).trim();
  if (sentence.length <= REASON_MAX) return sentence;
  const head = sentence.slice(0, REASON_MAX);
  const clause = Math.max(head.indexOf(' ('), head.lastIndexOf('; '));
  if (clause > 60) return `${head.slice(0, clause).replace(/[,:]$/, '')}.`;
  return `${head.slice(0, head.lastIndexOf(' '))}…`;
}

/**
 * The labels of the checks an answer failed, from a "missing <label>, <label>: <answer>" note. A "one of: A | B"
 * label holds its own colon, so it is taken whole (the checker gives such a case no other check).
 */
function failedChecks(note: string): string[] | null {
  if (!note.startsWith('missing ')) return null;
  const body = note.slice('missing '.length);
  if (body.startsWith('one of: ')) {
    // The answer starts after the last title, so a colon inside an earlier title does not cut the label short.
    const lastTitle = Math.max(body.lastIndexOf(' | '), 'one of: '.length);
    const end = body.indexOf(': ', lastTitle);
    return [end < 0 ? body : body.slice(0, end)];
  }
  const end = body.indexOf(': ');
  return (end < 0 ? body : body.slice(0, end)).split(', ').filter(Boolean);
}

/** Checks that pass when something is absent: failing one means the answer said something it should not have. */
const RULE_BROKEN: Record<string, string> = {
  'no contact details': 'it gave contact details',
  'names nobody': 'it named a person',
  'invents no hours': 'it stated study hours the record does not give',
};

/** What failing a check means: a broken rule, none of the expected answers, or a published fact left out. */
function checksReason(labels: string[]): string {
  const broken: string[] = [];
  const leftOut: string[] = [];
  for (const label of labels) {
    if (RULE_BROKEN[label]) broken.push(RULE_BROKEN[label]);
    else if (/^invents no /.test(label)) broken.push(`it invented ${label.slice('invents no '.length)}`);
    else if (/^no /.test(label)) broken.push(`it included ${label.slice('no '.length)}`);
    else if (label.startsWith('one of: ')) broken.push(`it named none of ${label.slice('one of: '.length).split(' | ').map((t) => `"${t}"`).join(' or ')}`);
    else leftOut.push(`"${label}"`);
  }
  const parts = [
    leftOut.length ? `The answer left out ${leftOut.join(', ')}, which the published record states.` : '',
    broken.length ? `The answer failed a check: ${broken.join('; ')}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
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
