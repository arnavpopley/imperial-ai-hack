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

/** The public page a published fact was copied from. */
const PageUrl = z.url({ protocol: /^https$/ });

/** One assessment component as published on the module page. */
export const PublishedAssessment = z.object({
  type: z.enum(['examination', 'coursework', 'practical']),
  description: z.string(),
  weighting: S.Fraction,
  /** Pass mark for this component as published, such as "40%" or "PF" (pass/fail). */
  passMark: z.string().min(1).optional(),
  /** True when the page says the component must be passed. */
  mustPass: z.boolean().optional(),
  /** Set only when the component comes from a page other than the module's sourceUrl (a BPES module outline). */
  sourceUrl: PageUrl.optional(),
});

/** A weekly teaching time published on the module page (I-Explore and BPES modules publish these). */
export const PublishedSlot = z.object({ day: S.Weekday, start: S.HHMM, end: S.HHMM });

/** One sentence or line copied from a public page, with the page heading it sat under when that helps to read it. */
export const PublishedFact = z.object({ label: z.string().min(1).optional(), text: z.string().min(1), sourceUrl: PageUrl });

const Lines = z.array(z.string().min(1)).min(1);

/** One reading-list entry as the library catalogue prints it; category is the list heading (Core, Supplementary...). */
export const ReadingItem = z.object({
  title: z.string().min(1),
  author: z.string().min(1).optional(),
  details: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

/**
 * Published fields beyond the description, outcomes and weighted assessment (docs/knowledge-base.md). Every field is
 * optional: it is present only when the public page publishes it, and it is never filled in by hand or by a model.
 */
export const PublishedDetails = z.object({
  /** Set when the learning outcomes come from a page other than sourceUrl (the BPES module outlines). */
  learningOutcomesSourceUrl: PageUrl.optional(),
  /** "Module syllabus" or "Indicative core content". */
  syllabus: z.object({ items: Lines, sourceUrl: PageUrl }).optional(),
  /** "Teaching methods" or "Learning and teaching approach", one entry per paragraph. */
  teaching: z.object({ paragraphs: Lines, sourceUrl: PageUrl }).optional(),
  /** Sentences that state contact or study hours, copied verbatim; independentStudyHours only when stated as a number. */
  hours: z
    .object({
      statements: Lines,
      independentStudyHours: z.number().int().positive().optional(),
      sourceUrl: PageUrl,
    })
    .optional(),
  readingList: z.object({ items: z.array(ReadingItem).min(1), sourceUrl: PageUrl }).optional(),
  /** Names published as the module's contact on the public page (I-Explore and Horizons pages only); never emails. */
  moduleLeads: z
    .object({ names: Lines, role: z.enum(['lecturer', 'field leader']), sourceUrl: PageUrl })
    .optional(),
  /** Published pre-requisite text, expected background, attendance requirements and credit restrictions. */
  requirements: z.array(PublishedFact).min(1).optional(),
  /** The rest of the assessment section: overall pass mark, grading method, zero-weight items, deadlines and notes. */
  assessmentDetails: z
    .object({
      passMark: z.string().min(1).optional(),
      gradingMethod: z.string().min(1).optional(),
      formative: z.array(PublishedAssessment.omit({ weighting: true, sourceUrl: true })).min(1).optional(),
      notes: z.array(PublishedFact).min(1).optional(),
      sourceUrl: PageUrl,
    })
    .optional(),
  /** Department and programme notes: delivery, who offers the module, credit rules, term dates. */
  programmeNotes: z.array(PublishedFact).min(1).optional(),
});

/** A module as scraped from public pages, before the Module Analyst derives topics, skills and demand. */
export const RawModule = S.Module.omit({
  topics: true,
  skills: true,
  pathwayRelevance: true,
  demand: true,
  derivedBy: true,
  derivedRationale: true,
})
  .extend({
    assessment: z.array(PublishedAssessment),
    publishedSlot: PublishedSlot.nullable(),
  })
  .extend(PublishedDetails.shape);

export const RawModulesFile = z.object({ _note: Note, _assumptions: z.array(z.string()), modules: z.array(RawModule) });
export const ModulesFile = z.object({ _note: Note, modules: z.array(S.Module) });
export const SlotsFile = z.object({ _note: Note, slots: z.array(S.Slot) });
export const ProgrammeRulesFile = z.object({
  _note: Note,
  /** The highest module level open to each year of study (issue 51), keyed by year as a string. */
  levelCaps: z.object({ _note: Note, byYear: z.record(z.string().regex(/^[1-4]$/), z.number().int().min(1).max(4)) }),
  rules: z.array(S.ProgrammeRules).min(1),
});
export const PathwaysFile = z.object({ _note: Note, pathways: z.array(S.Pathway) });
export const SocietiesFile = z.object({ _note: Note, societies: z.array(S.Society) });

/** Staff-provided links per module (past papers, reading, video), keyed by module id. */
export const ModuleResourcesFile = z.object({ _note: Note, resources: z.record(z.string(), z.array(S.ModuleResource)) });

/** One synthetic student: a profile and the modules they shortlisted. */
export const CohortStudent = z.object({ profile: S.StudentProfile, shortlist: z.array(z.string()).min(1) });
export const CohortFile = z.object({ _note: Note, students: z.array(CohortStudent) });

/** Synthetic examiner feedback forms for a few Year 2 exams (spec 23), so the demo has published forms to use. */
export const ExamFormsFile = z.object({ _note: Note, forms: z.array(S.ExamFeedbackForm) });

export type RawModule = z.infer<typeof RawModule>;
export type PublishedDetails = z.infer<typeof PublishedDetails>;
export type PublishedFact = z.infer<typeof PublishedFact>;
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
  moduleResources: 'module-resources.json',
  examForms: 'exam-forms.json',
} as const;

/**
 * Path to a file in data/. A bundled deployment (scripts/build-vercel.ts) ships its own copy of data/ and
 * points MODULEMATCH_DATA_DIR at it; read lazily so the entry point can set it first.
 */
export function dataPath(file: string): string {
  return resolve(process.env.MODULEMATCH_DATA_DIR ?? DATA_DIR, file);
}

/** Read a file from data/ and validate it, throwing a zod error that names the failing path. */
export function readDataset<T extends z.ZodType>(file: string, schema: T): z.infer<T> {
  const json: unknown = JSON.parse(readFileSync(dataPath(file), 'utf8'));
  return schema.parse(json);
}
