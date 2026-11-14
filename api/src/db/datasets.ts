// Shapes of the JSON datasets in data/ and a validating reader (WS1, spec section 15).
// Every file carries a `_note` saying whether it is public, sample, illustrative or synthetic data.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemas as S } from '@modulematch/shared';
import { z } from 'zod';

/** Repository root, resolved from this file so scripts and tests work from any working directory. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DATA_DIR = resolve(REPO_ROOT, 'data');

const Note = z.string().min(1);

/** One assessment component as published on the module page. */
export const PublishedAssessment = z.object({
  type: z.enum(['examination', 'coursework', 'practical']),
  description: z.string(),
  weighting: S.Fraction,
});

/** A weekly teaching time published on the module page (I-Explore and BPES modules publish these). */
export const PublishedSlot = z.object({ day: S.Weekday, start: S.HHMM, end: S.HHMM });

/** A module as scraped from public pages, before the Module Analyst derives topics, skills and demand. */
export const RawModule = S.Module.omit({
  topics: true,
  skills: true,
  pathwayRelevance: true,
  demand: true,
  derivedBy: true,
  derivedRationale: true,
}).extend({
  assessment: z.array(PublishedAssessment),
  publishedSlot: PublishedSlot.nullable(),
});

export const RawModulesFile = z.object({ _note: Note, _assumptions: z.array(z.string()), modules: z.array(RawModule) });
export const ModulesFile = z.object({ _note: Note, modules: z.array(S.Module) });
export const SlotsFile = z.object({ _note: Note, slots: z.array(S.Slot) });
export const ProgrammeRulesFile = z.object({ _note: Note, rules: z.array(S.ProgrammeRules).min(1) });
export const PathwaysFile = z.object({ _note: Note, pathways: z.array(S.Pathway) });
export const SocietiesFile = z.object({ _note: Note, societies: z.array(S.Society) });

/** One synthetic student: a profile and the modules they shortlisted. */
export const CohortStudent = z.object({ profile: S.StudentProfile, shortlist: z.array(z.string()).min(1) });
export const CohortFile = z.object({ _note: Note, students: z.array(CohortStudent) });

export type RawModule = z.infer<typeof RawModule>;
export type CohortStudent = z.infer<typeof CohortStudent>;

/** File names under data/. */
export const DATASET_FILES = {
  rawModules: 'modules.raw.json',
  modules: 'modules.json',
  slots: 'slots.json',
  programmeRules: 'programme-rules.json',
  pathways: 'pathways.json',
  societies: 'societies.json',
  cohort: 'cohort.json',
} as const;

/** Read a file from data/ and validate it, throwing a zod error that names the failing path. */
export function readDataset<T extends z.ZodType>(file: string, schema: T): z.infer<T> {
  const json: unknown = JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf8'));
  return schema.parse(json);
}
