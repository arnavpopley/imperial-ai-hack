// Could item 14: society matching, top five plus one wildcard.
import type { Society } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { matchSocieties } from '../src/engines/index.ts';
import { makeProfile } from './engines-fixtures.ts';

const society = (id: string, topics: Society['topics']): Society => ({
  id,
  name: id,
  description: 'Test society.',
  topics,
  sourceUrl: 'https://www.imperialcollegeunion.org/',
});
const societies = [
  society('chess', { 'history-philosophy': 1 }),
  society('aero', { 'fluid-mechanics': 1 }),
  society('robotics', { 'control-robotics': 1 }),
  society('ai', { 'machine-learning-ai': 1 }),
  society('mixed', { 'fluid-mechanics': 0.5, languages: 0.5 }),
  society('languages', { languages: 1 }),
  society('finance', { 'fluid-mechanics': 0.1, 'finance-economics': 0.9 }),
];
const profile = makeProfile({
  interests: { 'fluid-mechanics': 1, 'control-robotics': 0.8, 'machine-learning-ai': 0.6, languages: 0.2 },
});

describe('matchSocieties', () => {
  it('returns the top five by interest alignment, then a wildcard outside the top interests', () => {
    const matches = matchSocieties(profile, societies);
    expect(matches.map((m) => [m.societyId, m.fit, m.wildcard])).toEqual([
      ['aero', 100, false],
      ['robotics', 80, false],
      ['ai', 60, false],
      ['mixed', 60, false],
      ['languages', 20, false],
      ['chess', 0, true],
    ]);
    expect(matches[0]?.reason).toBe('Shares your interests: Fluid mechanics.');
    expect(matches[5]?.reason).toContain('History and philosophy');
  });

  it('does not call the wildcard outside the top interests when it shares one', () => {
    const allOverlap = [...societies.slice(1, 6), society('motorsport', { 'fluid-mechanics': 0.2, 'finance-economics': 0.8 })];
    const wildcard = matchSocieties(profile, allOverlap).find((m) => m.wildcard);
    expect(wildcard?.societyId).toBe('motorsport');
    expect(wildcard?.reason).toBe(
      'The most different option left: centred on Finance and economics, though it shares some of your top interests.',
    );
  });

  it('never picks a wildcard built on a topic the student said to avoid (issue 117)', () => {
    // A robotics student who would avoid fluid mechanics and thermodynamics.
    const robotics = makeProfile({
      interests: { 'control-robotics': 0.9, 'machine-learning-ai': 0.8, 'programming-software': 0.7, 'fluid-mechanics': 0.1, 'thermodynamics-energy': 0.1 },
    });
    const pool = [
      society('robo', { 'control-robotics': 1 }),
      society('ml', { 'machine-learning-ai': 1 }),
      society('code', { 'programming-software': 1 }),
      society('drones', { 'control-robotics': 0.6, 'machine-learning-ai': 0.4 }),
      society('hack', { 'programming-software': 0.7, 'machine-learning-ai': 0.3 }),
      society('aero', { 'fluid-mechanics': 1 }),
      society('engines', { 'thermodynamics-energy': 0.6, languages: 0.4 }),
      society('light-touch', { 'fluid-mechanics': 0.2, 'history-philosophy': 0.8 }),
      society('chess', { 'history-philosophy': 0.9, 'control-robotics': 0.1 }),
    ];
    const wildcard = matchSocieties(robotics, pool).find((m) => m.wildcard);
    // aero and engines are built on avoided topics; light-touch only grazes one, so it may be chosen.
    expect(wildcard?.societyId).toBe('light-touch');
    const onlyAvoided = [...pool.slice(0, 5), pool[5]!, pool[6]!];
    expect(matchSocieties(robotics, onlyAvoided).some((m) => m.wildcard)).toBe(false);
  });

  it('omits the wildcard when there are five societies or fewer', () => {
    expect(matchSocieties(profile, societies.slice(0, 5)).some((m) => m.wildcard)).toBe(false);
  });

  it('is deterministic under a shuffled input order', () => {
    expect(matchSocieties(profile, [...societies].reverse())).toEqual(matchSocieties(profile, societies));
  });
});
