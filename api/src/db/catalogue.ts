// Loaders for the datasets that live only as JSON (not in SQLite): programme rules, pathways and societies.
// Each file is validated with zod on first use and cached for the life of the process.
import type { ModuleResource, Pathway, ProgrammeRules, Society } from '@modulematch/shared';
import {
  DATASET_FILES,
  ModuleResourcesFile,
  PathwaysFile,
  ProgrammeRulesFile,
  RawModulesFile,
  readDataset,
  SocietiesFile,
  type RawModule,
} from './datasets.ts';

let rulesCache: ProgrammeRules[] | null = null;
let pathwaysCache: Pathway[] | null = null;
let societiesCache: Society[] | null = null;
let resourcesCache: Record<string, ModuleResource[]> | null = null;
let rawCache: Map<string, RawModule> | null = null;

/** Illustrative programme rules (spec 9.1), one entry per programme and year. */
export function loadProgrammeRules(): ProgrammeRules[] {
  rulesCache ??= readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile).rules;
  return rulesCache;
}

/** The rules for one programme and year of study, or null when that combination has none. */
export function rulesFor(programme: string, year: number): ProgrammeRules | null {
  return loadProgrammeRules().find((r) => r.programme === programme && r.year === year) ?? null;
}

/** Sample career pathways with skill weights (spec 9.4). */
export function loadPathways(): Pathway[] {
  pathwaysCache ??= readDataset(DATASET_FILES.pathways, PathwaysFile).pathways;
  return pathwaysCache;
}

/** Sample of public Imperial College Union societies with taxonomy topic tags. */
export function loadSocieties(): Society[] {
  societiesCache ??= readDataset(DATASET_FILES.societies, SocietiesFile).societies;
  return societiesCache;
}

/** Staff-provided links for each module (past papers, reading lists, recordings). */
export function loadModuleResources(): Record<string, ModuleResource[]> {
  resourcesCache ??= readDataset(DATASET_FILES.moduleResources, ModuleResourcesFile).resources;
  return resourcesCache;
}

/** The public module pages as fetched, including published assessment, which the knowledge agent can quote. */
export function rawModule(id: string): RawModule | undefined {
  rawCache ??= new Map(readDataset(DATASET_FILES.rawModules, RawModulesFile).modules.map((m) => [m.id, m]));
  return rawCache.get(id);
}
