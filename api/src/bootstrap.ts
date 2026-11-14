// Loads the seed datasets into an empty database, so `npm run dev` and the tests work without a separate
// seed step. `npm run seed` remains the way to rebuild the database from scratch.
import { getDb } from './db/client.ts';
import { CohortFile, DATASET_FILES, ModulesFile, readDataset, SlotsFile } from './db/datasets.ts';
import { listModules, replaceCohort, replaceModules, replaceSlots } from './db/repo.ts';

export function seedIfEmpty(db = getDb()): boolean {
  if (listModules(db).length > 0) return false;
  replaceModules(readDataset(DATASET_FILES.modules, ModulesFile).modules, db);
  replaceSlots(readDataset(DATASET_FILES.slots, SlotsFile).slots, db);
  replaceCohort(readDataset(DATASET_FILES.cohort, CohortFile).students, db);
  return true;
}
