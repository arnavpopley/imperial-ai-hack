// Filters Adaption's expanded extraction dataset to rows that our pipeline could actually emit: the prompt has the
// advisor/student shape, the question maps to an interview step, every slot is whitelisted (isAllowedSlot) and every
// value passes its slot schema (schemas.slotValueSchema). Rejects are reported by reason.
// Rows that fail only on their label are then repaired (repair.ts): Adaption's invented slot names are mapped onto
// the whitelist where the meaning is unambiguous, and what cannot be mapped is dropped.
// Writes expanded-valid.jsonl (strictly valid new rows), expanded-repaired.jsonl (repaired rows, with the slots that
// were dropped) and validate-report.json.
// Usage: npx tsx scripts/adaption/validate-expanded.ts [path/to/expanded.jsonl]
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LABEL_REASONS, repairRow } from './repair.ts';
import { ADAPTION_DIR, EXPANDED_FILE, readJsonl, REPAIRED_FILE, SEED_FILE, toRow, VALID_FILE, validateRow, type ParsedRow, type RejectReason } from './rows.ts';

const input = process.argv[2] ? resolve(process.argv[2]) : EXPANDED_FILE;
const seed = readJsonl(SEED_FILE).map(toRow);
const seedAnswers = new Set(seed.map((r) => validateRow(r)).flatMap((v) => (v.ok ? [v.row.answer.toLowerCase()] : [])));
const raw = readJsonl(input);

const valid: ParsedRow[] = [];
const repaired: (ParsedRow & { original: string; dropped: string[] })[] = [];
const rejects: { reason: RejectReason; detail?: string; prompt: string }[] = [];
const answers = new Set<string>();
for (const r of raw) {
  const row = toRow(r);
  const v = validateRow(row);
  if (!v.ok) {
    rejects.push({ reason: v.reason, detail: v.detail, prompt: row.prompt.slice(0, 200) });
    const fixed = LABEL_REASONS.includes(v.reason) ? repairRow(row) : null;
    if (fixed && !seedAnswers.has(fixed.row.answer.toLowerCase()) && !answers.has(fixed.row.answer.toLowerCase())) {
      answers.add(fixed.row.answer.toLowerCase());
      repaired.push({ ...fixed.row, original: row.completion, dropped: fixed.dropped });
    }
    continue;
  }
  const key = v.row.answer.toLowerCase();
  if (seedAnswers.has(key)) {
    rejects.push({ reason: 'duplicate of a seed row', prompt: row.prompt.slice(0, 200) });
    continue;
  }
  if (answers.has(key)) {
    rejects.push({ reason: 'duplicate answer', prompt: row.prompt.slice(0, 200) });
    continue;
  }
  answers.add(key);
  valid.push(v.row);
}

const byReason = Object.entries(
  rejects.reduce<Record<string, number>>((acc, r) => ((acc[r.reason] = (acc[r.reason] ?? 0) + 1), acc), {}),
).sort((a, b) => b[1] - a[1]);
const byStep = valid.reduce<Record<string, number>>((acc, r) => ((acc[r.stepId] = (acc[r.stepId] ?? 0) + 1), acc), {});
const bySlotKind = valid
  .flatMap((r) => r.updates.map((u) => (u.slot.startsWith('interest:') ? (u.dislike ? 'interest (dislike)' : 'interest') : u.slot)))
  .reduce<Record<string, number>>((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {});
const emptyLabels = valid.filter((r) => r.updates.length === 0).length;

const line = (r: { prompt: string; completion: string }) => JSON.stringify({ prompt: r.prompt, completion: r.completion });
const lines = (rows: string[]) => (rows.length ? `${rows.join('\n')}\n` : '');
writeFileSync(VALID_FILE, lines(valid.map(line)));
writeFileSync(REPAIRED_FILE, lines(repaired.map((r) => JSON.stringify({ prompt: r.prompt, completion: r.completion, original_completion: r.original, dropped_slots: r.dropped }))));
const repairedByStep = repaired.reduce<Record<string, number>>((acc, r) => ((acc[r.stepId] = (acc[r.stepId] ?? 0) + 1), acc), {});
const droppedSlots = repaired.reduce((n, r) => n + r.dropped.length, 0);
const keptSlots = repaired.reduce((n, r) => n + r.updates.length, 0);
const report = {
  input,
  rows: raw.length,
  valid: valid.length,
  rejected: rejects.length,
  rejectsByReason: Object.fromEntries(byReason),
  validByStep: byStep,
  labelsBySlot: bySlotKind,
  emptyLabels,
  repaired: { rows: repaired.length, byStep: repairedByStep, slotsKept: keptSlots, slotsDropped: droppedSlots },
  rejects,
};
writeFileSync(resolve(ADAPTION_DIR, 'validate-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`${raw.length} rows read from ${input}`);
console.log(`${valid.length} valid new rows, ${rejects.length} rejected, ${emptyLabels} valid rows with no updates`);
for (const [reason, n] of byReason) console.log(`  ${String(n).padStart(4)}  ${reason}`);
console.log(`valid rows by interview step: ${JSON.stringify(byStep)}`);
console.log(`repaired ${repaired.length} label-only rejects (${keptSlots} slots mapped, ${droppedSlots} dropped): ${JSON.stringify(repairedByStep)}`);
