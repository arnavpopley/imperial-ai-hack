// Spec 9.4: pathway progress with min(1, Σu) capping and the next-best module.
import type { Pathway, Recommendation } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { pathwayProgress } from '../src/engines/index.ts';
import { makeModule, makeProfile } from './engines-fixtures.ts';

const pathway: Pathway = {
  id: 'software',
  title: 'Software engineering',
  description: 'Test pathway.',
  skills: { teamwork: 0.25, coding: 0.75 },
  sampleOpportunities: [],
};
const modules = [
  makeModule('done', { skills: { coding: 0.7 } }),
  makeModule('listed', { skills: { coding: 0.6 } }),
  makeModule('more-coding', { skills: { coding: 1 } }),
  makeModule('team-b', { skills: { teamwork: 0.4 } }),
  makeModule('team-a', { skills: { teamwork: 0.4 } }),
  makeModule('locked', { skills: { teamwork: 1 } }),
];
const eligible = (moduleId: string, isEligible = true): Recommendation => ({
  moduleId,
  fit: 50,
  sub: { interest: 0, goal: null, style: 0, breadth: 0 },
  eligible: isEligible,
  ineligibleReasons: [],
  confidence: 'high',
});
const ranked = [
  eligible('done'),
  eligible('listed'),
  eligible('more-coding'),
  eligible('team-b'),
  eligible('team-a'),
  eligible('locked', false),
];
const profile = makeProfile({ completedModuleIds: ['done'] });

describe('pathwayProgress', () => {
  it('caps each skill at min(1, Σu) and breaks it down by importance', () => {
    const result = pathwayProgress(profile, pathway, modules, ['listed'], ranked);
    // coding: min(1, 0.7 + 0.6) = 1, teamwork: 0. Progress = 0.75·1 / 1.
    expect(result.progress).toBeCloseTo(0.75);
    expect(result.perSkill).toEqual([
      { skill: 'coding', importance: 0.75, covered: 1 },
      { skill: 'teamwork', importance: 0.25, covered: 0 },
    ]);
  });

  it('picks the eligible module with the largest marginal gain, tie-broken by id', () => {
    const result = pathwayProgress(profile, pathway, modules, ['listed'], ranked);
    // more-coding adds nothing once coding is capped; locked is ineligible.
    expect(result.nextBest?.moduleId).toBe('team-a');
    expect(result.nextBest?.gain).toBeCloseTo(0.1);
  });

  it('returns no next-best module when nothing adds progress', () => {
    const covered = pathwayProgress(profile, pathway, modules, ['listed', 'team-a', 'team-b'], ranked);
    expect(covered.nextBest).toBeNull();
  });
});
