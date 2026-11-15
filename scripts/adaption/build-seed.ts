// Builds the seed dataset for Adaption: student utterances paired with the profile slots they should fill.
// Labels are drafted by the real pipeline (G2 and G3 redaction, then the live extractor) and must be reviewed by a
// person before upload; scripts/adaption/seed-reviewed.jsonl is the reviewed copy.
// Usage: npx tsx scripts/adaption/build-seed.ts   (needs ANTHROPIC_API_KEY; about 34 Haiku calls, a few cents)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extract } from '../../server/src/agents/extractor.ts';
import { QUICK_PLAN } from '../../server/src/agents/interviewer.ts';
import { loadPathways } from '../../server/src/db/catalogue.ts';
import { REPO_ROOT } from '../../server/src/db/datasets.ts';
import { runInputGuardrails } from '../../server/src/guardrails/pipeline.ts';
import { createTracer } from '../../server/src/trace/tracer.ts';

const envFile = resolve(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const QUESTION_TO_STEP: Record<string, string> = {
  interest: 'love',
  avoid: 'avoid',
  career: 'career',
  assessment: 'assessment',
  team: 'team',
  breadth: 'breadth',
  timetable: 'timetable',
};

const seed: { question: string; text: string }[] = JSON.parse(readFileSync(resolve(REPO_ROOT, 'scripts/adaption/seed-utterances.json'), 'utf8'));
const pathwayIds = loadPathways().map((p) => p.id);
const tracer = createTracer('adaption-seed', () => {});
const rows: string[] = [];
for (const s of seed) {
  const step = QUICK_PLAN.find((p) => p.id === QUESTION_TO_STEP[s.question])!;
  const guarded = await runInputGuardrails(s.text, { mode: 'INTERVIEW', tracer });
  const updates = await extract(guarded.text, step.slots, pathwayIds);
  const prompt = `The advisor asked: "${step.question}"\nThe student answered: "${s.text}"`;
  const completion = JSON.stringify({
    updates: updates.map((u) => ({ slot: u.slot, value: u.value, ...(u.dislike ? { dislike: true } : {}) })),
  });
  rows.push(JSON.stringify({ prompt, completion }));
  console.log(`${s.text}\n   -> ${completion}\n`);
}
writeFileSync(resolve(REPO_ROOT, 'scripts/adaption/seed-draft.jsonl'), `${rows.join('\n')}\n`);
