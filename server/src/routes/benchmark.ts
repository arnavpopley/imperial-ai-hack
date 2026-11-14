// Read-only headline numbers from the independent ranking benchmark (docs/ranking-benchmark.md), for the
// "How it works" page. The full results stay in data/benchmark-latest.json; this returns the summary only.
import { existsSync, readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { z } from 'zod';
import { dataPath } from '../db/datasets.ts';

export const BENCHMARK_FILE = 'benchmark-latest.json';

const Metrics = z.object({ precisionAt5: z.number(), recallAt5: z.number(), ndcgAt5: z.number(), meanJudgeRank: z.number() });

/** The fields of the benchmark file the page shows. Anything else in the file is ignored. */
export const BenchmarkSummary = z.object({
  at: z.string(),
  judge: z.object({ model: z.string(), effort: z.string(), samplesPerPersona: z.number() }),
  k: z.number(),
  eligibleModules: z.number(),
  personasScored: z.number(),
  summary: z.object({ engine: Metrics, randomBaseline: Metrics, judgeSelfAgreement: z.number() }),
});
export type BenchmarkSummary = z.infer<typeof BenchmarkSummary>;

/** The headline numbers, or null when the benchmark has not been run. Read on each request so a re-run shows at once. */
export function benchmarkSummary(): BenchmarkSummary | null {
  const file = dataPath(BENCHMARK_FILE);
  if (!existsSync(file)) return null;
  const data = BenchmarkSummary.parse(JSON.parse(readFileSync(file, 'utf8')));
  return {
    at: data.at,
    judge: { model: data.judge.model, effort: data.judge.effort, samplesPerPersona: data.judge.samplesPerPersona },
    k: data.k,
    eligibleModules: data.eligibleModules,
    personasScored: data.personasScored,
    summary: { engine: data.summary.engine, randomBaseline: data.summary.randomBaseline, judgeSelfAgreement: data.summary.judgeSelfAgreement },
  };
}

export const benchmarkRoutes = new Hono().get('/benchmark', (c) => c.json(benchmarkSummary()));
