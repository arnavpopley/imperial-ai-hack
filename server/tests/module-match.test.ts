// Issue #57: which module a chat shortlist command names, on the seed catalogue. Exact codes and titles win,
// looser matches count only within the pool, and a weak or tied match is a question, not an edit.
import { describe, expect, it } from 'vitest';
import { matchModules } from '../src/agents/module-match.ts';
import { DATASET_FILES, ModulesFile, readDataset } from '../src/db/datasets.ts';

const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
const DYNAMICS = 'MECH50008';
const MACHINE_DYNAMICS = 'MECH60001';
const ROBOT_DYNAMICS = 'MECH70057';

describe('matchModules for a removal (pool = the shortlist)', () => {
  it('removes Dynamics when Dynamics is shortlisted', () => {
    expect(matchModules('remove Dynamics', modules, [DYNAMICS, MACHINE_DYNAMICS])).toEqual({ matched: [DYNAMICS], suggestions: [] });
  });

  it('names Dynamics but suggests the shortlisted module when Dynamics is not shortlisted', () => {
    expect(matchModules('drop dynamics', modules, ['MECH60009', MACHINE_DYNAMICS, 'MECH60018'])).toEqual({
      matched: [DYNAMICS],
      suggestions: [MACHINE_DYNAMICS],
    });
  });

  it('offers both when two shortlisted titles are similar', () => {
    expect(matchModules('remove Dynamics', modules, [MACHINE_DYNAMICS, ROBOT_DYNAMICS])).toEqual({
      matched: [DYNAMICS],
      suggestions: [MACHINE_DYNAMICS, ROBOT_DYNAMICS],
    });
  });

  it('reads "Machine Dynamics" as the shortlisted Machine Dynamics and Vibrations A, not the Year 2 Dynamics', () => {
    expect(matchModules('Remove Machine Dynamics from my shortlist', modules, ['MECH60009', MACHINE_DYNAMICS])).toEqual({
      matched: [MACHINE_DYNAMICS],
      suggestions: [],
    });
  });

  it('does not read a title inside a longer one or inside a word', () => {
    expect(matchModules('remove Computational Fluid Dynamics', modules, ['MECH70015']).matched).toEqual(['MECH70015']);
    expect(matchModules('remove Thermodynamics 3A', modules, ['MECH60011']).matched).toEqual(['MECH60011']);
  });

  it('never borrows a word from another mention to expand an exact title', () => {
    expect(matchModules('remove Machine Learning and Dynamics', modules, ['MECH70025', MACHINE_DYNAMICS])).toEqual({
      matched: ['MECH70025', DYNAMICS],
      suggestions: [MACHINE_DYNAMICS],
    });
  });

  it('reads a code followed by its own title as one module', () => {
    expect(matchModules('remove MECH70015 Computational Fluid Dynamics', modules, [DYNAMICS])).toEqual({ matched: ['MECH70015'], suggestions: [] });
  });

  it('keeps an exact code even when a shortlisted title shares the words around it', () => {
    expect(matchModules('remove machine MECH50008 vibrations', modules, [MACHINE_DYNAMICS, DYNAMICS]).matched).toEqual([DYNAMICS]);
  });

  it('acts on a shortlisted module that shares two title words', () => {
    expect(matchModules('remove the dynamics and control one', modules, [ROBOT_DYNAMICS])).toEqual({ matched: [ROBOT_DYNAMICS], suggestions: [] });
  });

  it('asks rather than guesses when the only match shares one word', () => {
    expect(matchModules('take the vibrations one off', modules, [MACHINE_DYNAMICS, ROBOT_DYNAMICS])).toEqual({
      matched: [],
      suggestions: [MACHINE_DYNAMICS],
    });
  });
});

describe('matchModules for an addition (pool = eligible, not yet shortlisted)', () => {
  it('matches codes exactly', () => {
    expect(matchModules('add MECH60009 and MECH60018', modules, ['MECH60009', 'MECH60018'])).toEqual({
      matched: ['MECH60009', 'MECH60018'],
      suggestions: [],
    });
  });

  it('asks which Mechatronics is meant instead of picking one', () => {
    expect(matchModules('add mechatronics', modules, ['MECH40004', 'MECH50004', 'MECH60018'])).toEqual({
      matched: [],
      suggestions: ['MECH40004', 'MECH50004', 'MECH60018'],
    });
    // Only Mechatronics 3A is open to a Year 3 student, and one shared word is still too weak to act on.
    expect(matchModules('add mechatronics', modules, ['MECH60018', 'MECH60009'])).toEqual({ matched: [], suggestions: ['MECH60018'] });
  });
});
