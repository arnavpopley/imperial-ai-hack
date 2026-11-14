// Independent ranking benchmark (docs/ranking-benchmark.md). Forty personas; for each, an LLM "experienced
// personal tutor" sees only the student's words and the modules' public pages and picks a top five, twice,
// with the module list in a different order each time. The engine's ranking from the structured profile is
// scored against the union of those picks: precision@5, recall@5, NDCG@5 and the mean engine rank of the
// judge's picks. Results go to data/benchmark-latest.json.
//
// Usage: `npm run benchmark` (needs ANTHROPIC_API_KEY; a fresh run costs about $0.50 with Sonnet 5.5 at
// medium effort, about $1.60 with --judge-model claude-opus-5-5). Options go after `--`, e.g.
// `npm run benchmark -- --rescore`.
//   --rescore        no API calls: re-score the engine against the judge picks already saved (free, for tag edits)
//   --fresh          ignore saved judge picks and sample the judge again
//   --limit N        only the first N personas (a pilot)
//   --effort E       judge effort, low or medium (default medium)
//   --judge-model M  judge model id (default: the smart tier, MODEL_SMART or claude-sonnet-5-5)
//   --out FILE       write somewhere other than data/benchmark-latest.json (for judge robustness checks)
//   --max-dollars X  stop calling the judge once this run has spent X dollars (default 5)
// Saved judge picks are reused whenever the persona's words, the module pages, the model and the effort are
// unchanged, because the judge never sees the tags or scores: re-running after a tag edit costs nothing.
import { combineFit, DEFAULT_WEIGHTS, type Module, type StudentProfile, type Weights } from '@modulematch/shared';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isLive, modelId, type Effort } from '../../server/src/agents/llm.ts';
import { rulesFor } from '../../server/src/db/catalogue.ts';
import { DATASET_FILES, dataPath, ModulesFile, RawModulesFile, readDataset, REPO_ROOT, type RawModule } from '../../server/src/db/datasets.ts';
import { interestAlignment, rankModules } from '../../server/src/engines/scoring.ts';
import { BENCHMARK_FILE } from '../../server/src/routes/benchmark.ts';
import { addUsage, costOf, emptyUsage, isPriced, judgeOnce, judgeSystem, type JudgePick, type Usage } from './judge.ts';
import { K, meanMetrics, randomBaseline, scoreRanking, selfAgreement, tallyVotes, type PersonaMetrics, type Votes } from './metrics.ts';
import { BENCHMARK_PERSONAS, type BenchmarkPersona, type Trait } from './personas.ts';

const SAMPLES = 2;
const CONCURRENCY = 4;
/** Topic weights below this count as minor tags in the "primary topics only" diagnostic. */
const PRIMARY_TOPIC = 0.5;

// ---------- arguments ----------

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const rescoreOnly = flag('rescore');
const fresh = flag('fresh');
const limit = option('limit') ? Number(option('limit')) : BENCHMARK_PERSONAS.length;
const effort = (option('effort') ?? 'medium') as Effort;
const maxDollars = Number(option('max-dollars') ?? 5);
if (!['low', 'medium'].includes(effort)) throw new Error('--effort must be low or medium');

const envFile = resolve(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
delete process.env.MODULEMATCH_OFFLINE;

// ---------- data ----------

const modules = readDataset(DATASET_FILES.modules, ModulesFile).modules;
const rawById = new Map(readDataset(DATASET_FILES.rawModules, RawModulesFile).modules.map((m) => [m.id, m]));
const byId = new Map(modules.map((m) => [m.id, m]));
const programme = 'MEng Mechanical Engineering';
const rules = rulesFor(programme, 3);
if (!rules) throw new Error('No programme rules for MEng Mechanical Engineering Year 3.');
/** Year 1 and 2 core modules: every Year 3 persona has passed them, as session defaults assume. */
const completed = modules.filter((m) => m.type === 'core' && m.level < 3).map((m) => m.id);

const profileOf = (p: BenchmarkPersona): StudentProfile => ({
  studentId: `benchmark-${p.id}`,
  programme,
  yearOfStudy: 3,
  completedModuleIds: completed,
  interests: p.interests,
  pathways: p.pathways,
  pathwaysSkipped: p.pathways.length === 0,
  style: p.style,
  breadthAppetite: p.breadthAppetite,
  timetablePrefs: { avoidDays: [], earliestStart: null },
  completeness: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** The optional modules the engine may recommend: eligible and not core (core modules are not a choice). */
const optionalIds = rankModules(profileOf(BENCHMARK_PERSONAS[0]!), modules, DEFAULT_WEIGHTS, rules)
  .filter((r) => r.eligible && byId.get(r.moduleId)!.type !== 'core')
  .map((r) => r.moduleId)
  .sort();
const optionalRaw: RawModule[] = optionalIds.map((id) => {
  const raw = rawById.get(id);
  if (!raw) throw new Error(`No public page for ${id} in modules.raw.json.`);
  return raw;
});
const codeToId = new Map(optionalRaw.map((m) => [m.code, m.id]));

/** Two orderings, so position bias in the judge averages out across the two samples. */
const orderings = [optionalRaw, [...optionalRaw].reverse()];
const systems = orderings.map(judgeSystem);
const codes = optionalRaw.map((m) => m.code);

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const model = option('judge-model') ?? modelId('smart');
const sampleKey = (p: BenchmarkPersona, sample: number) => hash([systems[sample], p.description, model, effort, sample].join('\u0000'));

// ---------- judge, with saved picks reused ----------

interface SavedSample {
  key: string;
  model: string;
  effort: Effort;
  order: 'catalogue' | 'reversed';
  picks: JudgePick[];
  usage: Usage;
}

interface SavedFile {
  personas?: { id: string; judge: { samples: SavedSample[] } }[];
  /** Saved samples for personas left out of a --limit run, kept so a pilot never discards paid-for picks. */
  retainedSamples?: SavedSample[];
  cost?: { cumulativeDollars?: number };
}

const outPath = option('out') ? resolve(option('out')!) : dataPath(BENCHMARK_FILE);
const previous: SavedFile | null = existsSync(outPath) ? (JSON.parse(readFileSync(outPath, 'utf8')) as SavedFile) : null;
const saved = new Map<string, SavedSample>();
for (const p of previous?.personas ?? []) for (const s of p.judge.samples) saved.set(s.key, s);
for (const s of previous?.retainedSamples ?? []) saved.set(s.key, s);

const personas = BENCHMARK_PERSONAS.slice(0, limit);
if (!rescoreOnly && !isLive()) throw new Error('The benchmark judge needs ANTHROPIC_API_KEY (in .env or the environment). Use --rescore to re-score saved picks.');
if (!isPriced(model)) console.warn(`Note: no price table for ${model}; costs are estimated at Sonnet 5.5 rates.`);

let runUsage = emptyUsage();
let calls = 0;
let reused = 0;
let stopped = false;
const spent = () => costOf(runUsage, model);

async function sampleJudge(p: BenchmarkPersona, sample: number): Promise<SavedSample | null> {
  const key = sampleKey(p, sample);
  const order = sample === 0 ? 'catalogue' : 'reversed';
  const hit = saved.get(key);
  if (hit && !fresh) {
    reused++;
    return hit;
  }
  if (rescoreOnly) throw new Error(`No saved judge picks for ${p.id} sample ${sample + 1}; run without --rescore.`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (spent() >= maxDollars) {
      stopped = true;
      return null;
    }
    calls++;
    try {
      const reply = await judgeOnce(systems[sample]!, codes, p.description, effort, model);
      runUsage = addUsage(runUsage, reply.usage);
      return { key, model, effort, order, picks: reply.picks, usage: reply.usage };
    } catch (error) {
      const usage = (error as { usage?: Usage }).usage;
      if (usage) runUsage = addUsage(runUsage, usage);
      console.warn(`  ${p.id} sample ${sample + 1} attempt ${attempt} failed: ${(error as Error).message}`);
    }
  }
  return null;
}

/** Runs tasks with at most `n` in flight. */
async function pool<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]!();
      }
    }),
  );
  return results;
}

const started = Date.now();
const samplesByPersona = new Map<string, (SavedSample | null)[]>();
// Warm each ordering's cache with one call before fanning out, so parallel calls read the cached catalogue.
const [first] = personas;
if (first) samplesByPersona.set(first.id, [await sampleJudge(first, 0), await sampleJudge(first, 1)]);
await pool(
  personas.slice(1).map((p) => async () => {
    const pair = await Promise.all([sampleJudge(p, 0), sampleJudge(p, 1)]);
    samplesByPersona.set(p.id, pair);
    process.stdout.write('.');
  }),
  CONCURRENCY,
);
if (personas.length > 1) process.stdout.write('\n');

// ---------- engine and metrics ----------

const title = (id: string) => byId.get(id)?.title ?? id;
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

interface Ranked {
  id: string;
  fit: number;
  sub: { interest: number; goal: number | null; style: number; breadth: number };
}

/** The engine's ranking of the optional modules, with a diagnostic interest variant applied when asked. */
function engineRanking(p: BenchmarkPersona, weights: Weights, primaryTopicsOnly = false): Ranked[] {
  const recs = rankModules(profileOf(p), modules, weights, rules!).filter((r) => optionalIds.includes(r.moduleId));
  const rows = recs.map((r) => {
    if (!primaryTopicsOnly) return { id: r.moduleId, fit: r.fit, sub: r.sub };
    const topics = Object.fromEntries(Object.entries(byId.get(r.moduleId)!.topics).filter(([, t]) => t >= PRIMARY_TOPIC));
    const sub = { ...r.sub, interest: interestAlignment(p.interests, topics) };
    return { id: r.moduleId, fit: combineFit(sub, weights), sub };
  });
  return rows.sort((a, b) => b.fit - a.fit || a.id.localeCompare(b.id));
}

/** Why the engine might have kept a judge pick out of its top five. Heuristics, for the analysis only. */
function missFlags(p: BenchmarkPersona, m: Module, row: Ranked): string[] {
  const flags: string[] = [];
  const overlap = Object.keys(m.topics).filter((t) => (p.interests[t] ?? 0) >= 0.5);
  if (overlap.length === 0) flags.push('no-topic-overlap');
  const primary = Object.fromEntries(Object.entries(m.topics).filter(([, t]) => t >= PRIMARY_TOPIC));
  if (overlap.length > 0 && interestAlignment(p.interests, primary) - row.sub.interest >= 0.15) flags.push('interest-dilution');
  if (row.sub.goal !== null && row.sub.goal < 0.4) flags.push('low-goal');
  if (row.sub.style < 0.6) flags.push('low-style');
  return flags;
}

interface PersonaResult {
  id: string;
  name: string;
  traits: Trait[];
  metrics: PersonaMetrics;
  judgeSelfAgreement: number;
  engineTop5: { id: string; title: string; fit: number; votes: number; sub: Ranked['sub'] }[];
  judgePicks: { id: string; title: string; votes: number; engineRank: number; fit: number; sub: Ranked['sub']; reasons: string[]; flags: string[] }[];
  judge: { samples: SavedSample[] };
}

const results: PersonaResult[] = [];
const skipped: string[] = [];
for (const p of personas) {
  const samples = (samplesByPersona.get(p.id) ?? []).filter((s): s is SavedSample => s !== null);
  if (samples.length < SAMPLES) {
    skipped.push(p.id);
    continue;
  }
  const lists = samples.map((s) => s.picks.map((pick) => codeToId.get(pick.code)!));
  const { votes, consensus } = tallyVotes(lists);
  const ranking = engineRanking(p, DEFAULT_WEIGHTS);
  const order = ranking.map((r) => r.id);
  const rowOf = new Map(ranking.map((r) => [r.id, r]));
  results.push({
    id: p.id,
    name: p.name,
    traits: p.traits,
    metrics: scoreRanking(order, votes, SAMPLES),
    judgeSelfAgreement: selfAgreement(lists),
    engineTop5: ranking.slice(0, K).map((r) => ({ id: r.id, title: title(r.id), fit: r.fit, votes: votes[r.id] ?? 0, sub: r.sub })),
    judgePicks: consensus.map((id) => {
      const row = rowOf.get(id)!;
      const rank = order.indexOf(id) + 1;
      return {
        id,
        title: title(id),
        votes: votes[id]!,
        engineRank: rank,
        fit: row.fit,
        sub: row.sub,
        reasons: samples.flatMap((s) => s.picks.filter((pick) => codeToId.get(pick.code) === id).map((pick) => pick.reason)),
        flags: rank > K ? missFlags(p, byId.get(id)!, row) : [],
      };
    }),
    judge: { samples },
  });
}

const votesOf = (r: PersonaResult): Votes => Object.fromEntries(r.judgePicks.map((j) => [j.id, j.votes]));
const overall = meanMetrics(results.map((r) => r.metrics));
const random = meanMetrics(results.map((r) => randomBaseline(optionalIds, votesOf(r), SAMPLES)));
const agreement = results.length ? results.reduce((s, r) => s + r.judgeSelfAgreement, 0) / results.length : 0;
const roundMetrics = (m: PersonaMetrics): PersonaMetrics => ({
  precisionAt5: round(m.precisionAt5),
  recallAt5: round(m.recallAt5),
  ndcgAt5: round(m.ndcgAt5),
  meanJudgeRank: round(m.meanJudgeRank, 2),
});

const traits: Trait[] = ['strong', 'weak', 'breadth', 'exam-averse', 'null-style', 'contradictory', 'multi-pathway', 'undecided'];
const byTrait = Object.fromEntries(
  traits.map((t) => {
    const rows = results.filter((r) => r.traits.includes(t));
    return [t, { personas: rows.length, ...roundMetrics(meanMetrics(rows.map((r) => r.metrics))) }];
  }),
);

/** Diagnostics only: the same judge picks scored against variants of the engine. The engine is unchanged. */
const variants: { name: string; weights: Weights; primaryTopicsOnly?: boolean }[] = [
  { name: 'spec weights (the engine)', weights: DEFAULT_WEIGHTS },
  { name: 'interest only', weights: { interest: 1, goal: 0, style: 0, breadth: 0 } },
  { name: 'without goal', weights: { ...DEFAULT_WEIGHTS, goal: 0 } },
  { name: 'without style', weights: { ...DEFAULT_WEIGHTS, style: 0 } },
  { name: 'without breadth', weights: { ...DEFAULT_WEIGHTS, breadth: 0 } },
  { name: 'interest over primary topics only (weight >= 0.5)', weights: DEFAULT_WEIGHTS, primaryTopicsOnly: true },
];
const personaById = new Map(personas.map((p) => [p.id, p]));
const diagnostics = variants.map((v) => ({
  name: v.name,
  ...roundMetrics(meanMetrics(results.map((r) => scoreRanking(engineRanking(personaById.get(r.id)!, v.weights, v.primaryTopicsOnly).map((x) => x.id), votesOf(r), SAMPLES)))),
}));

/** Per module: how often the judge chose it, how often the engine did, and where they disagree. */
const moduleStats = optionalIds
  .map((id) => {
    let judgeVotes = 0;
    let judgePersonas = 0;
    let engineTop5 = 0;
    const missedFor: string[] = [];
    const unendorsedFor: string[] = [];
    for (const r of results) {
      const pick = r.judgePicks.find((j) => j.id === id);
      const inTop = r.engineTop5.some((e) => e.id === id);
      if (pick) {
        judgeVotes += pick.votes;
        judgePersonas++;
      }
      if (inTop) engineTop5++;
      if (pick && pick.votes === SAMPLES && !inTop) missedFor.push(r.id);
      if (inTop && !pick) unendorsedFor.push(r.id);
    }
    return { id, title: title(id), type: byId.get(id)!.type, judgeVotes, judgePersonas, engineTop5, missedFor, unendorsedFor };
  })
  .sort((a, b) => b.missedFor.length + b.unendorsedFor.length - (a.missedFor.length + a.unendorsedFor.length) || a.id.localeCompare(b.id));

const flagCounts: Record<string, number> = {};
let missedTotal = 0;
for (const r of results)
  for (const j of r.judgePicks.filter((x) => x.votes === SAMPLES && x.engineRank > K)) {
    missedTotal++;
    for (const f of j.flags.length ? j.flags : ['unexplained']) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  }

// ---------- write and print ----------

const usedKeys = new Set(results.flatMap((r) => r.judge.samples.map((s) => s.key)));
const totalUsage = results.reduce((u, r) => r.judge.samples.reduce((acc, s) => addUsage(acc, s.usage), u), emptyUsage());
const output = {
  _note:
    'Synthetic benchmark output (docs/ranking-benchmark.md). Personas are invented; the judge is an LLM given only the persona description and the public module pages. Regenerate with `npm run benchmark`.',
  at: new Date().toISOString(),
  judge: { model, effort, samplesPerPersona: SAMPLES, orderings: ['catalogue', 'reversed'] },
  k: K,
  eligibleModules: optionalIds.length,
  weights: DEFAULT_WEIGHTS,
  personasScored: results.length,
  personasSkipped: skipped,
  summary: {
    engine: roundMetrics(overall),
    randomBaseline: roundMetrics(random),
    judgeSelfAgreement: round(agreement),
    byTrait,
    diagnostics,
    missedFirmPicks: missedTotal,
    missCauses: flagCounts,
  },
  cost: {
    thisRun: { calls, reusedSamples: reused, usage: runUsage, dollars: round(spent(), 4), seconds: Math.round((Date.now() - started) / 1000) },
    judgePicksAsSaved: { usage: totalUsage, dollars: round(costOf(totalUsage, model), 4) },
    cumulativeDollars: round((previous?.cost?.cumulativeDollars ?? 0) + spent(), 4),
  },
  modules: moduleStats,
  personas: results,
  retainedSamples: [...saved.values()].filter((s) => !usedKeys.has(s.key) && s.model === model && s.effort === effort),
};
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log(`\nRanking benchmark: ${results.length} personas, judge ${model} (effort ${effort}), ${SAMPLES} samples each, ${optionalIds.length} optional modules`);
console.log(`              engine   random`);
console.log(`precision@5   ${pct(overall.precisionAt5).padEnd(8)} ${pct(random.precisionAt5)}`);
console.log(`recall@5      ${pct(overall.recallAt5).padEnd(8)} ${pct(random.recallAt5)}`);
console.log(`NDCG@5        ${overall.ndcgAt5.toFixed(2).padEnd(8)} ${random.ndcgAt5.toFixed(2)}`);
console.log(`mean rank     ${overall.meanJudgeRank.toFixed(1).padEnd(8)} ${random.meanJudgeRank.toFixed(1)}   (of the judge's picks in the engine's list of ${optionalIds.length})`);
console.log(`judge self-agreement ${pct(agreement)} (top-five overlap between its two samples)`);
console.log('\nBy trait:');
for (const [t, m] of Object.entries(byTrait)) if (m.personas) console.log(`  ${t.padEnd(14)} n=${String(m.personas).padEnd(3)} P@5 ${pct(m.precisionAt5)}  R@5 ${pct(m.recallAt5)}  NDCG ${m.ndcgAt5.toFixed(2)}`);
console.log('\nDiagnostics (same judge picks, engine variants; the engine itself is unchanged):');
for (const d of diagnostics) console.log(`  ${d.name.padEnd(50)} P@5 ${pct(d.precisionAt5)}  R@5 ${pct(d.recallAt5)}  NDCG ${d.ndcgAt5.toFixed(2)}`);
console.log(`\nFirm judge picks the engine left out of its top five: ${missedTotal}. Flags: ${JSON.stringify(flagCounts)}`);
console.log('Worst personas by NDCG@5:');
for (const r of [...results].sort((a, b) => a.metrics.ndcgAt5 - b.metrics.ndcgAt5).slice(0, 8)) {
  console.log(`  ${r.id.padEnd(24)} NDCG ${r.metrics.ndcgAt5.toFixed(2)}  engine ${r.engineTop5.map((e) => e.id).join(',')}  judge ${r.judgePicks.map((j) => `${j.id}x${j.votes}`).join(',')}`);
}
const u = runUsage;
console.log(`\nThis run: ${calls} judge calls, ${reused} saved samples reused, ${u.input} input + ${u.cacheWrite} cache-write + ${u.cacheRead} cache-read + ${u.output} output tokens = $${spent().toFixed(3)}`);
console.log(`Cumulative benchmark spend recorded: $${output.cost.cumulativeDollars.toFixed(3)}`);
if (stopped) console.warn(`Stopped calling the judge at the --max-dollars limit ($${maxDollars}).`);
if (skipped.length) {
  console.warn(`Skipped (no complete judge samples): ${skipped.join(', ')}`);
  process.exitCode = 1;
}
