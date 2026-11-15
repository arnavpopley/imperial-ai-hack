// The latest live-model evaluation (`npm run eval:live`, spec 18), read-only, for the "How it works" page. The run
// costs money, so it is committed as data/eval-live-latest.json and never re-run on a deploy; this serves that file.
import { schemas } from '@modulematch/shared';
import { existsSync, readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { z } from 'zod';
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

export const liveEvalRoutes = new Hono().get('/live', (c) => c.json(latestLiveEval()));
