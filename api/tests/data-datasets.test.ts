// WS1 data tests: every dataset in data/ parses against its schema and is internally consistent.
import { SKILL_IDS, TOPIC_IDS } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { clashProbability } from '../../scripts/lib/timetable.ts';
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
} from '../src/db/datasets.ts';

const raw = readDataset(DATASET_FILES.rawModules, RawModulesFile);
const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
const slotsFile = readDataset(DATASET_FILES.slots, SlotsFile);
const { slots } = slotsFile;
const { rules } = readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile);
const { pathways } = readDataset(DATASET_FILES.pathways, PathwaysFile);
const { societies } = readDataset(DATASET_FILES.societies, SocietiesFile);
const cohort = readDataset(DATASET_FILES.cohort, CohortFile);

const moduleIds = new Set(modules.map((m) => m.id));
const pathwayIds = new Set(pathways.map((p) => p.id));
const topicIds = new Set<string>(TOPIC_IDS);
const skillIds = new Set<string>(SKILL_IDS);
const year3 = rules.find((r) => r.programme === 'MEng Mechanical Engineering' && r.year === 3);

describe('modules', () => {
  it('has 40 to 60 modules with unique ids, matching modules.raw.json', () => {
    expect(modules.length).toBeGreaterThanOrEqual(40);
    expect(modules.length).toBeLessThanOrEqual(60);
    expect(moduleIds.size).toBe(modules.length);
    expect(raw.modules.map((m) => m.id)).toEqual(modules.map((m) => m.id));
  });

  it('keeps the public text and source of every raw module', () => {
    const byId = new Map(raw.modules.map((m) => [m.id, m]));
    for (const m of modules) {
      const r = byId.get(m.id);
      expect(m.description).toBe(r?.description);
      expect(m.sourceUrl).toBe(r?.sourceUrl);
      expect(m.sourceUrl).toMatch(/^https:\/\/www\.imperial\.ac\.uk\//);
    }
  });

  it('uses only taxonomy topics and skills, and only known pathway ids', () => {
    for (const m of modules) {
      for (const k of Object.keys(m.topics)) expect(topicIds, `${m.id} topic ${k}`).toContain(k);
      for (const k of Object.keys(m.skills)) expect(skillIds, `${m.id} skill ${k}`).toContain(k);
      expect(new Set(Object.keys(m.pathwayRelevance))).toEqual(pathwayIds);
    }
  });

  it('references only existing modules as prerequisites', () => {
    for (const m of modules) for (const p of m.prerequisites) expect(moduleIds, `${m.id} needs ${p}`).toContain(p);
  });

  it('was derived by the analyst agent', () => {
    for (const m of modules) expect(m.derivedBy).toBe('analyst-agent');
  });
});

describe('programme rules', () => {
  it('include MEng Mechanical Engineering Year 3 with an I-Explore requirement', () => {
    expect(year3?.iExploreRequired).toBe(true);
    expect(year3?.coreModuleIds.length).toBeGreaterThan(0);
  });

  it('reference only existing modules and taxonomy topics', () => {
    for (const r of rules) {
      for (const id of [...r.coreModuleIds, ...r.allowedElectiveIds]) expect(moduleIds, `${r.year}: ${id}`).toContain(id);
      for (const k of Object.keys(r.homeTopics)) expect(topicIds).toContain(k);
    }
  });
});

describe('slots', () => {
  const byKey = new Map<string, typeof slots>();
  for (const s of slots) byKey.set(s.sessionKey, [...(byKey.get(s.sessionKey) ?? []), s]);
  const slotsOf = (id: string) => slots.filter((s) => s.moduleId === id);

  it('label the timetable as synthetic', () => {
    expect(slotsFile._note).toMatch(/^Synthetic/);
  });

  it('give every module a lecture in each of its terms, and only for known modules', () => {
    for (const s of slots) expect(moduleIds).toContain(s.moduleId);
    for (const m of modules) {
      for (const term of m.terms) {
        expect(slotsOf(m.id).some((s) => s.term === term && s.kind === 'lecture'), `${m.id} ${term}`).toBe(true);
      }
    }
  });

  it('run between 09:00 and 18:00 and keep Wednesday afternoons free', () => {
    for (const s of slots) {
      expect(s.start >= '09:00' && s.end <= '18:00' && s.start < s.end).toBe(true);
      if (s.day === 'wed') expect(s.end <= '12:00').toBe(true);
    }
  });

  it('have candidate probabilities that sum to 1 for every session', () => {
    for (const [key, group] of byKey) {
      const total = group.reduce((sum, s) => sum + s.probability, 0);
      expect(total, key).toBeCloseTo(1, 9);
      if (group.length > 1) {
        expect(group.length, key).toBeLessThanOrEqual(3);
        expect(group.every((s) => s.provisional)).toBe(true);
      } else {
        expect(group[0]?.provisional).toBe(false);
      }
    }
  });

  it('make about 20% of modules provisional', () => {
    const provisional = new Set(slots.filter((s) => s.provisional).map((s) => s.moduleId));
    expect(provisional.size / modules.length).toBeGreaterThanOrEqual(0.15);
    expect(provisional.size / modules.length).toBeLessThanOrEqual(0.25);
  });

  it('contain at least one certain clash between two Year 3 electives', () => {
    const electives = modules.filter((m) => m.level === 3 && m.type === 'elective');
    const certain = electives.flatMap((a, i) =>
      electives.slice(i + 1).filter((b) => clashProbability(slotsOf(a.id), slotsOf(b.id)) === 1),
    );
    expect(certain.length).toBeGreaterThan(0);
  });
});

describe('pathways', () => {
  it('has eight pathways with taxonomy skills and two to four sample opportunities', () => {
    expect(pathways).toHaveLength(8);
    for (const p of pathways) {
      for (const k of Object.keys(p.skills)) expect(skillIds).toContain(k);
      expect(p.sampleOpportunities.length).toBeGreaterThanOrEqual(2);
      expect(p.sampleOpportunities.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('societies', () => {
  it('has about 25 public union societies with taxonomy topics', () => {
    expect(societies.length).toBeGreaterThanOrEqual(20);
    expect(new Set(societies.map((s) => s.id)).size).toBe(societies.length);
    for (const s of societies) {
      expect(s.sourceUrl).toMatch(/^https:\/\/www\.imperialcollegeunion\.org\//);
      for (const k of Object.keys(s.topics)) expect(topicIds).toContain(k);
    }
  });
});

describe('cohort', () => {
  it('is labelled synthetic and holds about 200 Year 3 students', () => {
    expect(cohort._note).toMatch(/^Synthetic/);
    expect(cohort.students.length).toBeGreaterThanOrEqual(180);
    expect(new Set(cohort.students.map((s) => s.profile.studentId)).size).toBe(cohort.students.length);
  });

  it('has complete-enough profiles keyed by taxonomy topics and known pathways', () => {
    for (const { profile } of cohort.students) {
      expect(profile.studentId).toMatch(/^synthetic-/);
      expect(profile.yearOfStudy).toBe(3);
      expect(profile.completeness).toBeGreaterThanOrEqual(0.75);
      for (const k of Object.keys(profile.interests)) expect(topicIds).toContain(k);
      for (const p of profile.pathways) expect(pathwayIds).toContain(p);
      for (const id of profile.completedModuleIds) expect(moduleIds).toContain(id);
    }
  });

  it('shortlists 3 to 6 allowed Year 3 modules, exactly one of them I-Explore', () => {
    const allowed = new Set(year3?.allowedElectiveIds);
    const typeOf = new Map(modules.map((m) => [m.id, m.type]));
    for (const { shortlist } of cohort.students) {
      expect(shortlist.length).toBeGreaterThanOrEqual(3);
      expect(shortlist.length).toBeLessThanOrEqual(6);
      expect(new Set(shortlist).size).toBe(shortlist.length);
      for (const id of shortlist) expect(allowed).toContain(id);
      expect(shortlist.filter((id) => typeOf.get(id) === 'i-explore')).toHaveLength(1);
    }
  });
});
