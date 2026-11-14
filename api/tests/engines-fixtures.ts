// Small inline builders for the engine tests. Independent of data/ so WS1 can change the seed freely.
import type { Module, ProgrammeRules, Slot, StudentProfile } from '@modulematch/shared';

export function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    studentId: 'student-1',
    programme: 'MEng Mechanical Engineering',
    yearOfStudy: 3,
    completedModuleIds: [],
    interests: {},
    pathways: [],
    pathwaysSkipped: false,
    style: {
      examPreference: null,
      groupPreference: null,
      appliedPreference: null,
      mathsComfort: null,
      codingComfort: null,
      workloadTolerance: null,
    },
    breadthAppetite: null,
    timetablePrefs: { avoidDays: [], earliestStart: null },
    completeness: 1,
    updatedAt: '2026-11-14T18:00:00.000Z',
    ...overrides,
  };
}

export function makeModule(id: string, overrides: Partial<Module> = {}): Module {
  return {
    id,
    code: id.toUpperCase(),
    title: `Module ${id}`,
    department: 'Mechanical Engineering',
    level: 3,
    ects: 5,
    type: 'elective',
    terms: ['autumn'],
    description: 'Test module.',
    learningOutcomes: [],
    sourceUrl: 'https://www.imperial.ac.uk/',
    prerequisites: [],
    capacity: 100,
    topics: {},
    skills: {},
    pathwayRelevance: {},
    demand: { examShare: 0.5, groupShare: 0.5, applied: 0.5, mathsIntensity: 0.5, codingIntensity: 0.5, workload: 0.5 },
    derivedBy: 'analyst-agent',
    derivedRationale: 'Test.',
    ...overrides,
  };
}

export function makeRules(overrides: Partial<ProgrammeRules> = {}): ProgrammeRules {
  return {
    programme: 'MEng Mechanical Engineering',
    year: 3,
    coreModuleIds: [],
    allowedElectiveIds: [],
    electiveEctsRequired: 0,
    maxEcts: 60,
    iExploreRequired: false,
    homeTopics: {},
    ...overrides,
  };
}

/** A confirmed slot unless a probability below 1 is given. */
export function makeSlot(
  moduleId: string,
  day: Slot['day'],
  start: string,
  end: string,
  overrides: Partial<Slot> = {},
): Slot {
  const probability = overrides.probability ?? 1;
  return {
    moduleId,
    term: 'autumn',
    day,
    start,
    end,
    kind: 'lecture',
    provisional: probability < 1,
    probability,
    sessionKey: `${moduleId}-lecture`,
    ...overrides,
  };
}
