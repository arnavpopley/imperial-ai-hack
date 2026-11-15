// Loads the seed datasets into an empty database, so `npm run dev`, the tests and a fresh serverless instance
// work without a separate seed step. `npm run seed` remains the way to rebuild the database from scratch.
import { schemas } from '@modulematch/shared';
import { existsSync } from 'node:fs';
import { getDb } from './db/client.ts';
import { CohortFile, DATASET_FILES, dataPath, ExamFormsFile, ModulesFile, readDataset, SlotsFile } from './db/datasets.ts';
import { latestEvalRun, listExamForms, listModules, replaceCohort, replaceExamForms, replaceModules, replaceSlots, saveEvalRun } from './db/repo.ts';

/** The latest `npm run eval` result, committed so a fresh database can still show evaluation pass rates. */
export const EVAL_SNAPSHOT_FILE = 'eval-latest.json';

/** The synthetic exam forms are seeded whenever none exist, so databases created before spec 23 get them too. */
function seedExamFormsIfEmpty(db = getDb()): void {
  if (listExamForms(undefined, db).length === 0 && existsSync(dataPath(DATASET_FILES.examForms))) {
    replaceExamForms(readDataset(DATASET_FILES.examForms, ExamFormsFile).forms, db);
  }
}

export function seedIfEmpty(db = getDb()): boolean {
  seedExamFormsIfEmpty(db);
  if (listModules(db).length > 0) return false;
  replaceModules(readDataset(DATASET_FILES.modules, ModulesFile).modules, db);
  replaceSlots(readDataset(DATASET_FILES.slots, SlotsFile).slots, db);
  replaceCohort(readDataset(DATASET_FILES.cohort, CohortFile).students, db);
  if (!latestEvalRun(db) && existsSync(dataPath(EVAL_SNAPSHOT_FILE))) {
    saveEvalRun(readDataset(EVAL_SNAPSHOT_FILE, schemas.EvalRun), db);
  }
  return true;
}
