// `npm run seed`: deletes the SQLite database and rebuilds it from data/ (modules, slots, synthetic cohort and the
// committed offline evaluation run).
// Every dataset, including the JSON-only ones the API reads at runtime, is validated with zod first.
// Needs no API key.
import { rmSync } from 'node:fs';
import { databasePath, openDb } from '../server/src/db/client.ts';
import {
  CohortFile,
  DATASET_FILES,
  ModulesFile,
  PathwaysFile,
  ProgrammeRulesFile,
  RawModulesFile,
  readDataset,
  SlotsFile,
  SocietiesFile,
} from '../server/src/db/datasets.ts';
import { evalSnapshot } from '../server/src/bootstrap.ts';
import { latestEvalRun, listCohort, listModules, listSlots, replaceCohort, replaceModules, replaceSlots, saveEvalRun } from '../server/src/db/repo.ts';

function main(): void {
  const raw = readDataset(DATASET_FILES.rawModules, RawModulesFile);
  const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
  const { slots } = readDataset(DATASET_FILES.slots, SlotsFile);
  const { students } = readDataset(DATASET_FILES.cohort, CohortFile);
  const { rules } = readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile);
  const { pathways } = readDataset(DATASET_FILES.pathways, PathwaysFile);
  const { societies } = readDataset(DATASET_FILES.societies, SocietiesFile);

  const path = databasePath();
  if (path !== ':memory:') for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true });
  const db = openDb(path);
  replaceModules(modules, db);
  replaceSlots(slots, db);
  replaceCohort(students, db);
  // The committed offline evaluation, so the "How it works" page shows results straight after a reseed (issue #115).
  const snapshot = evalSnapshot();
  if (snapshot) saveEvalRun(snapshot, db);

  console.log(`Seeded ${path}`);
  console.log(`  modules          ${listModules(db).length} (from ${raw.modules.length} public descriptions)`);
  console.log(`  slots            ${listSlots(db).length}`);
  console.log(`  cohort_profiles  ${listCohort(db).length} synthetic students`);
  console.log(`  eval_runs        ${latestEvalRun(db) ? `committed run of ${latestEvalRun(db)!.at.slice(0, 10)}` : 'none'}`);
  console.log(`Validated JSON-only datasets: ${rules.length} programme rules, ${pathways.length} pathways, ${societies.length} societies`);
  db.$client.close();
}

main();
