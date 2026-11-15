// Builds train.jsonl, the cleaned prompt/completion dataset for AutoScientist: the hand-reviewed seed plus the Adaption
// rows whose relabel was agreed or fixed by the reviewer (relabel.ts). Every row passes the strict label validation, and
// no row carries Adaption's original labels.
// Usage: npx tsx scripts/adaption/build-train.ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADAPTION_DIR, readJsonl, SEED_FILE, toRow, TRAIN_FILE, validateRow } from './rows.ts';

const seed = readJsonl(SEED_FILE).map(toRow).map((r) => validateRow(r));
const relabelled = readJsonl(resolve(ADAPTION_DIR, 'relabelled.jsonl'))
  .filter((r) => r.verdict === 'agree' || r.verdict === 'fix')
  .map((r) => validateRow({ prompt: String(r.prompt), completion: String(r.completion) }, { anyQuestion: true }));
const rows = [...seed, ...relabelled].flatMap((v) => (v.ok ? [JSON.stringify({ prompt: v.row.prompt, completion: v.row.completion })] : []));
writeFileSync(TRAIN_FILE, `${rows.join('\n')}\n`);
console.log(`train.jsonl: ${seed.filter((v) => v.ok).length} seed + ${relabelled.filter((v) => v.ok).length} relabelled = ${rows.length} rows`);
