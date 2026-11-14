// Stress test: runs the extractor on every reviewed row and measures agreement with the reference labels per slot type.
// Interests and other strengths agree within 0.35; pathway and day sets must match exactly; flags and times exactly.
// Rows: the 34 hand-reviewed seed rows plus the Adaption rows relabelled by Opus 5.5 and reviewed by Fable 5.1
// (relabel.ts; flagged rows are left out). Adaption's own labels are not used: none of them passes our schema.
// Each answer first goes through the G2 and G3 pattern passes, as in the app (the live G2 span classifier is skipped
// to save cost; it can only remove more). Disagreements go to stress-<tag>.json, joined with the hand verdicts in
// disagreement-review.json so the report says who was right.
// Usage: npx tsx scripts/adaption/stress-extractor.ts [--model haiku|sonnet] [--baseline] [--offline] [--limit N] [--tag name]
//   --baseline  the extractor prompt and sentence-level G2 from before the fixes (baseline.ts)
//   --offline   the keyword-cue extractor (free)
// Live runs cost about $0.25 (Haiku 4.5) or $1 (Sonnet 5.5, low effort) for 180 rows, and stop at $1.50.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractByCues, keepValid, stated, type ExtractedUpdate } from '../../server/src/agents/extractor.ts';
import { REPO_ROOT } from '../../server/src/db/datasets.ts';
import { redactByPattern } from '../../server/src/guardrails/g2-redaction.ts';
import { stripInjection } from '../../server/src/guardrails/g3-injection.ts';
import { baselineExtract, baselineGuard } from './baseline.ts';
import { extractWith, spendReport, totalSpend, type Effort } from './models.ts';
import { ADAPTION_DIR, PATHWAY_IDS, readJsonl, SEED_FILE, toRow, validateRow, type LabelUpdate, type ParsedRow } from './rows.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const MODELS: Record<string, { id: string; effort?: Effort }> = {
  haiku: { id: 'claude-haiku-4-5' },
  sonnet: { id: 'claude-sonnet-5-5', effort: 'low' },
};
const offline = flag('offline');
const baseline = flag('baseline');
const modelKey = option('model') ?? 'haiku';
const model = MODELS[modelKey];
if (!model) throw new Error(`--model must be one of ${Object.keys(MODELS).join(', ')}`);
const tag = option('tag') ?? `${offline ? 'offline' : modelKey}-${baseline ? 'before' : 'after'}`;
const limit = Number(option('limit') ?? Infinity);
const BUDGET = 1.5;

const envFile = resolve(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (offline && baseline) throw new Error('--baseline is live only');

// ---------- rows ----------

const relabelled = resolve(ADAPTION_DIR, 'relabelled.jsonl');
type Source = 'seed' | 'adaption';
const rows: (ParsedRow & { source: Source })[] = [
  ...readJsonl(SEED_FILE)
    .map(toRow)
    .map((r) => validateRow(r))
    .flatMap((v) => (v.ok ? [{ ...v.row, source: 'seed' as const }] : [])),
  ...(existsSync(relabelled) ? readJsonl(relabelled) : [])
    .filter((r) => r.verdict === 'agree' || r.verdict === 'fix')
    .map((r) => validateRow({ prompt: String(r.prompt), completion: String(r.completion) }, { anyQuestion: true }))
    .flatMap((v) => (v.ok ? [{ ...v.row, source: 'adaption' as const }] : [])),
].slice(0, limit);

// ---------- comparison ----------

type SlotKind = 'interest' | 'style' | 'breadthAppetite' | 'pathways' | 'pathwaysSkipped' | 'avoidDays' | 'earliestStart';
const kindOf = (slot: string): SlotKind =>
  slot.startsWith('interest:') ? 'interest' : slot.startsWith('style.') ? 'style' : slot === 'timetablePrefs.avoidDays' ? 'avoidDays' : slot === 'timetablePrefs.earliestStart' ? 'earliestStart' : (slot as SlotKind);
const TOLERANCE = 0.35;

/** Collapses updates to one value per slot with the mergeUpdates rules. pathwaysSkipped false is the default, so it is dropped. */
function collapse(updates: (LabelUpdate | ExtractedUpdate)[]): Map<string, LabelUpdate> {
  const out = new Map<string, LabelUpdate>();
  for (const u of updates) {
    if (u.slot === 'pathwaysSkipped' && u.value === false) continue;
    const old = out.get(u.slot);
    if (u.slot.startsWith('interest:') && typeof u.value === 'number' && old && typeof old.value === 'number') {
      out.set(u.slot, u.dislike ? { slot: u.slot, value: Math.min(old.value, u.value), dislike: true } : { slot: u.slot, value: Math.max(old.value, u.value), ...(old.dislike ? { dislike: true } : {}) });
    } else out.set(u.slot, { slot: u.slot, value: u.value, ...(u.dislike ? { dislike: true } : {}) });
  }
  return out;
}

function agrees(a: LabelUpdate['value'], b: LabelUpdate['value']): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= TOLERANCE;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x) => b.includes(x));
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Disagreement {
  key: string;
  source: Source;
  question: string;
  answer: string;
  guarded: string;
  slot: string;
  type: 'missing' | 'extra' | 'value';
  reference: LabelUpdate['value'] | null;
  ours: LabelUpdate['value'] | null;
}

type Tally = { agree: number; total: number; missing: number; extra: number; value: number };
const perKind = new Map<SlotKind, Tally>();
const perSource = new Map<Source, { rows: number; exact: number; agree: number; total: number }>();
const bump = (kind: SlotKind, field: 'agree' | 'missing' | 'extra' | 'value') => {
  const k = perKind.get(kind) ?? { agree: 0, total: 0, missing: 0, extra: 0, value: 0 };
  k.total++;
  k[field]++;
  perKind.set(kind, k);
};
const disagreements: Disagreement[] = [];
let failures = 0;
let stoppedForBudget = false;

async function run(row: (typeof rows)[number]) {
  const guarded = baseline ? baselineGuard(row.answer) : stripInjection(redactByPattern(row.answer).text).text;
  let updates: ExtractedUpdate[];
  try {
    updates = offline
      ? keepValid(stated(guarded, extractByCues(guarded, row.targetSlots, PATHWAY_IDS), row.targetSlots), PATHWAY_IDS)
      : baseline
        ? await baselineExtract(model!.id, model!.effort, guarded, row.targetSlots, PATHWAY_IDS)
        : await extractWith(model!.id, model!.effort, guarded, row.targetSlots, PATHWAY_IDS);
  } catch {
    // In the app a failed call falls back to the keyword cues; here it counts as a failure and the row as empty.
    failures++;
    updates = [];
  }
  const ours = collapse(updates);
  const reference = collapse(row.updates);
  const src = perSource.get(row.source) ?? { rows: 0, exact: 0, agree: 0, total: 0 };
  src.rows++;
  let exact = true;
  for (const slot of new Set([...reference.keys(), ...ours.keys()])) {
    const a = reference.get(slot);
    const b = ours.get(slot);
    const type = !b ? 'missing' : !a ? 'extra' : agrees(a.value, b.value) ? null : 'value';
    src.total++;
    if (!type) {
      bump(kindOf(slot), 'agree');
      src.agree++;
      continue;
    }
    exact = false;
    bump(kindOf(slot), type);
    disagreements.push({ key: `${row.answer} | ${slot}`, source: row.source, question: row.question, answer: row.answer, guarded, slot, type, reference: a?.value ?? null, ours: b?.value ?? null });
  }
  if (exact) src.exact++;
  perSource.set(row.source, src);
}

const started = Date.now();
const queue = [...rows];
await Promise.all(
  Array.from({ length: offline ? 1 : 6 }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      if (totalSpend() > BUDGET) {
        stoppedForBudget = true;
        return;
      }
      await run(row);
    }
  }),
);

// ---------- report ----------

type Verdict = { verdict: 'ours' | 'reference' | 'ambiguous'; reason: string };
const reviewFile = resolve(ADAPTION_DIR, 'disagreement-review.json');
const review: Record<string, Verdict> = existsSync(reviewFile) ? JSON.parse(readFileSync(reviewFile, 'utf8')) : {};
const reviewed = disagreements.sort((a, b) => a.key.localeCompare(b.key)).map((d) => ({ ...d, review: review[d.key] ?? null }));
const verdicts = reviewed.reduce<Record<string, number>>((acc, d) => ((acc[d.review?.verdict ?? 'unreviewed'] = (acc[d.review?.verdict ?? 'unreviewed'] ?? 0) + 1), acc), {});
const kinds = [...perKind.entries()].sort((a, b) => b[1].total - a[1].total);
const totals = kinds.reduce((acc, [, k]) => ({ agree: acc.agree + k.agree, total: acc.total + k.total }), { agree: 0, total: 0 });
const rate = (a: number, b: number) => (b ? a / b : 0);
const summary = {
  tag,
  extractor: offline ? 'offline keyword cues' : `${baseline ? 'baseline' : 'current'} live prompt on ${model.id}${model.effort ? ` (effort ${model.effort})` : ''}`,
  rows: rows.length,
  failures,
  stoppedForBudget,
  slotAgreement: { ...totals, rate: rate(totals.agree, totals.total) },
  bySource: Object.fromEntries([...perSource.entries()].map(([s, v]) => [s, { ...v, slotRate: rate(v.agree, v.total), exactRate: rate(v.exact, v.rows) }])),
  perKind: Object.fromEntries(kinds.map(([kind, k]) => [kind, { ...k, rate: rate(k.agree, k.total) }])),
  verdicts,
  spend: spendReport(),
  usd: Number(totalSpend().toFixed(4)),
  seconds: Math.round((Date.now() - started) / 1000),
};
writeFileSync(resolve(ADAPTION_DIR, `stress-${tag}.json`), `${JSON.stringify({ summary, disagreements: reviewed }, null, 2)}\n`);

const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log(`${summary.extractor}: ${rows.length} rows${failures ? `, ${failures} failed calls` : ''}`);
console.log(`slot agreement ${totals.agree}/${totals.total} (${pct(summary.slotAgreement.rate)})`);
for (const [s, v] of perSource) console.log(`  ${s.padEnd(9)} ${v.agree}/${v.total} slots (${pct(rate(v.agree, v.total))}), ${v.exact}/${v.rows} rows exact`);
for (const [kind, k] of kinds) {
  console.log(`  ${kind.padEnd(16)} ${String(k.agree).padStart(4)}/${String(k.total).padEnd(4)} ${pct(rate(k.agree, k.total)).padStart(4)}   missing ${k.missing}, extra ${k.extra}, value ${k.value}`);
}
console.log(`verdicts: ${JSON.stringify(verdicts)}`);
if (!offline) console.log(`spend: ${spendReport()}${stoppedForBudget ? ' (stopped at the budget)' : ''}`);
console.log(`wrote scripts/adaption/stress-${tag}.json`);
