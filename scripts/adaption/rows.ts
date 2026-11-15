// Shared helpers for the Adaption extraction dataset: parsing a prompt back into the advisor's question and the
// student's answer, mapping the question to the interview step it came from, and validating a completion.
import { isAllowedSlot, schemas } from '@modulematch/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QUICK_PLAN } from '../../server/src/agents/interviewer.ts';
import { loadPathways } from '../../server/src/db/catalogue.ts';
import { REPO_ROOT } from '../../server/src/db/datasets.ts';

export const ADAPTION_DIR = resolve(REPO_ROOT, 'scripts/adaption');
export const SEED_FILE = resolve(ADAPTION_DIR, 'seed-reviewed.jsonl');
export const EXPANDED_FILE = resolve(ADAPTION_DIR, 'expanded.jsonl');
export const VALID_FILE = resolve(ADAPTION_DIR, 'expanded-valid.jsonl');
export const REPAIRED_FILE = resolve(ADAPTION_DIR, 'expanded-repaired.jsonl');
export const TRAIN_FILE = resolve(ADAPTION_DIR, 'train.jsonl');

export interface LabelUpdate {
  slot: string;
  value: number | string | boolean | string[];
  dislike?: boolean;
}

export interface Row {
  prompt: string;
  completion: string;
}

/** A validated row with its parts pulled out. */
export interface ParsedRow extends Row {
  question: string;
  answer: string;
  stepId: string;
  targetSlots: string[];
  updates: LabelUpdate[];
}

// Adaption's export may carry the original and enhanced versions of each column (see the expand runbook).
const PROMPT_COLS = ['prompt', 'enhanced_prompt', 'original_prompt'];
const COMPLETION_COLS = ['completion', 'enhanced_completion', 'original_completion'];

const firstPresent = (row: Record<string, unknown>, cols: string[]) => {
  for (const col of cols) {
    const value = row[col];
    if (typeof value === 'string' && value.trim() && value.trim() !== 'N/A') return value;
    if (col.includes('completion') && value && typeof value === 'object') return JSON.stringify(value);
  }
  return '';
};

export function readJsonl(file: string): Record<string, unknown>[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export const toRow = (raw: Record<string, unknown>): Row => ({ prompt: firstPresent(raw, PROMPT_COLS), completion: firstPresent(raw, COMPLETION_COLS) });

/** Keyword rules from a (possibly paraphrased) advisor question to the plan step it asks. Order matters. */
const STEP_RULES: [string, RegExp][] = [
  ['timetable', /\b(days?|times?|timetable|schedule|mornings?|free)\b/i],
  ['comfort', /\b(comfortable|sliders?|maths-heavy|coding-heavy)\b/i],
  ['team', /\b(alone|team|group|workload)\b/i],
  ['assessment', /\b(exams?|coursework|projects?|theory|hands-on|assessed|assessment)\b/i],
  ['breadth', /\b(outside your degree|language|business|arts|breadth|other departments?)\b/i],
  ['career', /\b(graduate|career|after (uni|university|your degree)|job|industry|work after)\b/i],
  ['avoid', /\b(avoid|dislike|steer clear|rather not|least)\b/i],
  ['love', /\b(lose track of time|enjoy|love|favourite|interest|excite|proud|lectures?|topics?)\b/i],
];

export function stepFor(question: string): { stepId: string; targetSlots: string[] } | null {
  const exact = QUICK_PLAN.find((s) => s.question === question);
  if (exact) return { stepId: exact.id, targetSlots: exact.slots };
  const rule = STEP_RULES.find(([, re]) => re.test(question));
  const step = rule && QUICK_PLAN.find((s) => s.id === rule[0]);
  return step ? { stepId: step.id, targetSlots: step.slots } : null;
}

/** Splits `The advisor asked: "..."\nThe student answered: "..."` into its two quotes. */
export function splitPrompt(prompt: string): { question: string; answer: string } | null {
  const m = prompt.match(/The advisor asked:\s*"([\s\S]*?)"\s*\n+\s*The student answered:\s*"([\s\S]*)"\s*$/);
  return m ? { question: m[1]!.trim(), answer: m[2]!.trim() } : null;
}

export type RejectReason =
  | 'missing prompt or completion'
  | 'prompt not in the advisor/student format'
  | 'advisor question matches no interview step'
  | 'completion is not JSON'
  | 'completion has no updates array'
  | 'slot not whitelisted'
  | 'value invalid for its slot'
  | 'unknown pathway id'
  | 'dislike is not a boolean'
  | 'dislike on a non-interest slot'
  | 'duplicate slot in one completion'
  | 'personal data in the answer'
  | 'duplicate of a seed row'
  | 'duplicate answer';

export const PATHWAY_IDS = loadPathways().map((p) => p.id);

/** Contact details or identifiers that must never be in a training row (the answers are meant to be synthetic). */
const PERSONAL_DATA = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /\b(\+44|0)\s?7\d{3}\s?\d{6}\b/, // UK mobile
  /\b\d{8}\b/, // an 8-digit student number (CID)
  /\b[a-z]{2,3}\d{3,5}\b/i, // an Imperial username such as ab1234
];

/**
 * Validates one row; returns the parsed row or the first reason it fails. With `anyQuestion`, a question that matches no
 * interview step is allowed and targets no slot, as an open question in the app does (used for relabelled rows).
 */
export function validateRow(row: Row, opts: { anyQuestion?: boolean } = {}): { ok: true; row: ParsedRow } | { ok: false; reason: RejectReason; detail?: string } {
  if (!row.prompt.trim() || !row.completion.trim()) return { ok: false, reason: 'missing prompt or completion' };
  const parts = splitPrompt(row.prompt);
  if (!parts) return { ok: false, reason: 'prompt not in the advisor/student format' };
  const step = stepFor(parts.question) ?? (opts.anyQuestion ? { stepId: 'open', targetSlots: [] } : null);
  if (!step) return { ok: false, reason: 'advisor question matches no interview step', detail: parts.question };
  const pd = PERSONAL_DATA.find((re) => re.test(parts.answer));
  if (pd) return { ok: false, reason: 'personal data in the answer', detail: parts.answer };
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.completion);
  } catch {
    return { ok: false, reason: 'completion is not JSON', detail: row.completion.slice(0, 120) };
  }
  const updates = (parsed as { updates?: unknown })?.updates;
  if (!Array.isArray(updates)) return { ok: false, reason: 'completion has no updates array' };
  const seen = new Set<string>();
  for (const u of updates as Record<string, unknown>[]) {
    const slot = String(u?.slot ?? '');
    if (!isAllowedSlot(slot)) return { ok: false, reason: 'slot not whitelisted', detail: slot };
    if (!schemas.slotValueSchema(slot)!.safeParse(u.value).success) return { ok: false, reason: 'value invalid for its slot', detail: `${slot}=${JSON.stringify(u.value)}` };
    // schemas.PathwayId accepts any non-empty string, so the ids are checked against data/pathways.json here.
    if (slot === 'pathways' && !(u.value as string[]).every((id) => PATHWAY_IDS.includes(id))) return { ok: false, reason: 'unknown pathway id', detail: JSON.stringify(u.value) };
    if (u.dislike !== undefined && typeof u.dislike !== 'boolean') return { ok: false, reason: 'dislike is not a boolean', detail: slot };
    if (u.dislike === true && !slot.startsWith('interest:')) return { ok: false, reason: 'dislike on a non-interest slot', detail: slot };
    if (seen.has(slot)) return { ok: false, reason: 'duplicate slot in one completion', detail: slot };
    seen.add(slot);
  }
  const clean = (updates as LabelUpdate[]).map((u) => ({ slot: u.slot, value: u.value, ...(u.dislike ? { dislike: true } : {}) }));
  return {
    ok: true,
    row: { prompt: row.prompt, completion: JSON.stringify({ updates: clean }), ...parts, ...step, updates: clean },
  };
}
