// Loads the seed datasets into an empty database, so `npm run dev`, the tests and a fresh serverless instance
// work without a separate seed step. `npm run seed` remains the way to rebuild the database from scratch.
import { schemas } from '@modulematch/shared';
import { existsSync } from 'node:fs';
import { getDb } from './db/client.ts';
import { CohortFile, DATASET_FILES, dataPath, ModulesFile, readDataset, SlotsFile } from './db/datasets.ts';
import { latestEvalRun, listModules, replaceCohort, replaceModules, replaceSlots, saveEvalRun } from './db/repo.ts';

/** The latest `npm run eval` result, committed so a fresh database can still show evaluation pass rates. */
export const EVAL_SNAPSHOT_FILE = 'eval-latest.json';

export function seedIfEmpty(db = getDb()): boolean {
  if (listModules(db).length > 0) return false;
  replaceModules(readDataset(DATASET_FILES.modules, ModulesFile).modules, db);
  replaceSlots(readDataset(DATASET_FILES.slots, SlotsFile).slots, db);
  replaceCohort(readDataset(DATASET_FILES.cohort, CohortFile).students, db);
  if (!latestEvalRun(db) && existsSync(dataPath(EVAL_SNAPSHOT_FILE))) {
    saveEvalRun(readDataset(EVAL_SNAPSHOT_FILE, schemas.EvalRun), db);
  }
  return true;
}
