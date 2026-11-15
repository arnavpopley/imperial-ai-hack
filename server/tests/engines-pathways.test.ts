// Spec 9.4: pathway progress with soft-capped skill depth, and the next-best module.
import { DEFAULT_WEIGHTS, type Pathway, type Recommendation } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { DATASET_FILES, ModulesFile, PathwaysFile, ProgrammeRulesFile, readDataset } from '../src/db/datasets.ts';
import { COMPLETED_WEIGHT, pathwayProgress, rankModules, SKILL_DEPTH } from '../src/engines/index.ts';
import { makeModule, makeProfile } from './engines-fixtures.ts';

const covered = (depth: number) => 1 - Math.exp(-depth / SKILL_DEPTH);

const pathway: Pathway = {
  id: 'software',
  title: 'Software engineering',
  description: 'Test pathway.',
  skills: { teamwork: 0.25, coding: 0.75 },
  sampleOpportunities: [],
};
const relevant = { pathwayRelevance: { software: 0.8 } };
const modules = [
  makeModule('done', { skills: { coding: 0.8 } }),
  makeModule('listed', { skills: { coding: 0.6 } }),
  makeModule('core', { type: 'core', skills: { teamwork: 0.9 } }),
  makeModule('more-coding', { skills: { coding: 1 }, pathwayRelevance: { software: 0.9 } }),
  makeModule('team-b', { skills: { teamwork: 0.4 }, ...relevant }),
  makeModule('team-a', { skills: { teamwork: 0.4 }, ...relevant }),
  makeModule('off-pathway', { skills: { coding: 1, teamwork: 1 }, pathwayRelevance: { software: 0.3 } }),
  makeModule('locked', { skills: { coding: 1 }, pathwayRelevance: { software: 1 } }),
];
const rec = (moduleId: string, fit = 50, eligible = true): Recommendation => ({
  moduleId,
  fit,
  sub: { interest: 0, goal: null, style: 0, breadth: 0 },
  eligible,
  ineligibleReasons: [],
  confidence: 'high',
});
const ranked = [
  rec('listed'),
  rec('core'),
  rec('more-coding', 40),
  rec('team-b', 70),
  rec('team-a', 60),
  rec('off-pathway', 90),
  rec('locked', 95, false),
];
const profile = makeProfile({ completedModuleIds: ['done'] });

describe('pathwayProgress', () => {
  it('measures depth with a soft cap, completed modules at half weight, most important skill first', () => {
    const result = pathwayProgress(profile, pathway, modules, ['listed'], ranked, ['core']);
    const coding = covered(COMPLETED_WEIGHT * 0.8 + 0.6);
    const teamwork = covered(0.9);
    expect(result.perSkill).toEqual([
      { skill: 'coding', importance: 0.75, covered: coding },
      { skill: 'teamwork', importance: 0.25, covered: teamwork },
    ]);
    expect(result.progress).toBeCloseTo(0.75 * coding + 0.25 * teamwork);
  });

  it('keeps rising with each module instead of saturating', () => {
    const one = pathwayProgress(profile, pathway, modules, ['listed'], ranked).progress;
    const two = pathwayProgress(profile, pathway, modules, ['listed', 'more-coding'], ranked).progress;
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(1);
  });

  it('picks the most relevant eligible module still to choose, then the best fit, with the skill it adds most to', () => {
    // more-coding is the most relevant; locked is more relevant but ineligible, off-pathway the best fit but under 0.5.
    const first = pathwayProgress(profile, pathway, modules, ['listed'], ranked, ['core']);
    expect(first.nextBest?.moduleId).toBe('more-coding');
    expect(first.nextBest?.skill).toBe('coding');
    // Once it is shortlisted, the two teamwork modules tie on relevance and the better fit wins.
    const next = pathwayProgress(profile, pathway, modules, ['listed', 'more-coding'], ranked, ['core']);
    expect(next.nextBest).toMatchObject({ moduleId: 'team-b', skill: 'teamwork' });
    expect(next.nextBest?.gain).toBeCloseTo(
      0.25 * (covered(0.9 + 0.4) - covered(0.9)),
    );
  });

  it('never offers a completed, core or shortlisted module, and returns null when nothing relevant is left', () => {
    const taken = ['listed', 'more-coding', 'team-a', 'team-b'];
    const result = pathwayProgress(profile, pathway, modules, taken, ranked, ['core']);
    expect(result.nextBest).toBeNull();
  });
});

describe("pathwayProgress for Rosa, Year 3 robotics (seed data)", () => {
  const { modules: catalogue } = readDataset(DATASET_FILES.modules, ModulesFile);
  const { pathways } = readDataset(DATASET_FILES.pathways, PathwaysFile);
  const rules = readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile).rules.find(
    (r) => r.programme === 'MEng Mechanical Engineering' && r.year === 3,
  );
  if (!rules) throw new Error('expected MEng Mechanical Engineering year 3 rules');
  const rosa = makeProfile({
    completedModuleIds: ['MECH40002', 'MECH40003', 'MECH40004', 'MECH40005', 'MECH40006', 'MECH40008', 'MECH50001', 'MECH50002', 'MECH50003', 'MECH50004', 'MECH50005', 'MECH50006', 'MECH50008', 'MECH50010'],
    interests: { 'control-robotics': 1, 'electronics-embedded': 0.9, 'design-manufacturing': 0.6 },
    pathways: ['robotics-automation'],
    style: { examPreference: 0.2, groupPreference: 0.4, appliedPreference: 1, mathsComfort: 0.7, codingComfort: 0.6, workloadTolerance: 0.7 },
  });
  const completed = new Set(rosa.completedModuleIds);
  const ranked = rankModules(rosa, catalogue, DEFAULT_WEIGHTS, rules).filter((r) => !completed.has(r.moduleId));
  const byId = new Map(catalogue.map((m) => [m.id, m]));
  const pathwayOf = (id: string) => {
    const found = pathways.find((p) => p.id === id);
    if (!found) throw new Error(`expected pathway ${id}`);
    return found;
  };
  const progressFor = (id: string, shortlist: string[]) =>
    pathwayProgress(rosa, pathwayOf(id), catalogue, shortlist, ranked, rules.coreModuleIds);

  it('sits well short of 100% after two years of core modules, and the shortlist moves it', () => {
    for (const p of pathways) {
      const progress = progressFor(p.id, []).progress;
      expect(progress, p.id).toBeGreaterThan(0.2);
      expect(progress, p.id).toBeLessThan(0.5);
    }
    const before = progressFor('robotics-automation', []).progress;
    const after = progressFor('robotics-automation', ['MECH60009', 'MECH60018', 'IEX-ML']).progress;
    expect(after).toBeGreaterThan(before + 0.1);
    expect(after).toBeLessThan(0.7);
  });

  it('names a robotics or control module as the next best for robotics, never a business module', () => {
    const next = progressFor('robotics-automation', []).nextBest;
    expect(next?.moduleId).toBe('MECH60018');
    expect(byId.get(next?.moduleId ?? '')?.title).toBe('Mechatronics 3A');
    // With Mechatronics 3A shortlisted, Embedded C (coding, the skill Rosa is missing most) is next.
    expect(progressFor('robotics-automation', ['MECH60018']).nextBest).toMatchObject({ moduleId: 'MECH60009', skill: 'coding' });
  });

  it('only ever suggests a module relevant to the pathway', () => {
    for (const p of pathways) {
      const next = progressFor(p.id, []).nextBest;
      if (next) expect(byId.get(next.moduleId)?.pathwayRelevance[p.id], p.id).toBeGreaterThanOrEqual(0.5);
    }
    expect(progressFor('software-data', []).nextBest?.moduleId).not.toBe('IEX-HISTSCI');
    expect(progressFor('aerospace-motorsport', []).nextBest?.moduleId).not.toBe('BUSI60041');
  });
});
