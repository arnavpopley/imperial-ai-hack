// The reworded interview (#181) asks which topics were hardest and offers a lighter, average or heavy workload, so the
// offline cues must read "the hardest" as a topic to avoid and a bare "heavy" as an answer.
import { describe, expect, it } from 'vitest';
import { extractByCues } from '../src/agents/extractor.ts';

const values = (text: string, slots: string[]) => Object.fromEntries(extractByCues(text, slots, []).map((u) => [u.slot, u.value]));
const TEAM_AND_WORKLOAD = ['style.groupPreference', 'style.workloadTolerance'];

describe('a topic called hard is a topic to avoid', () => {
  it('stores the hardest or a struggled-with topic low', () => {
    expect(values('Fluid mechanics was the hardest.', ['interest'])['interest:fluid-mechanics']).toBe(0.1);
    expect(values('I found thermodynamics really hard.', ['interest'])['interest:thermodynamics-energy']).toBe(0.1);
  });

  it('keeps a hard topic the student still enjoyed as an interest', () => {
    expect(values('Fluids was hard but I loved it.', ['interest'])['interest:fluid-mechanics']).toBe(0.85);
    expect(values('I loved fluid mechanics.', ['interest'])['interest:fluid-mechanics']).toBe(0.85);
  });

  it('ignores a negated difficulty', () => {
    expect(values("I didn't find fluid mechanics hard.", ['interest'])['interest:fluid-mechanics']).toBe(0.85);
  });

  it('marks only the topic the difficulty describes', () => {
    const got = values('Thermodynamics was hard, but I prefer fluid mechanics.', ['interest']);
    expect(got['interest:thermodynamics-energy']).toBe(0.1);
    expect(got['interest:fluid-mechanics']).toBe(0.85);
    const both = values('I love robotics but hate thermodynamics.', ['interest']);
    expect(both['interest:control-robotics']).toBe(0.85);
    expect(both['interest:thermodynamics-energy']).toBe(0.1);
  });
});

describe('the workload choices are each an answer', () => {
  it('reads a bare heavy on the team question and on the workload follow-up', () => {
    expect(values('A team, and heavy.', TEAM_AND_WORKLOAD)['style.workloadTolerance']).toBe(0.8);
    expect(values('Heavy.', ['style.workloadTolerance'])['style.workloadTolerance']).toBe(0.8);
  });

  it('reads a rejected heavy load as a light one', () => {
    expect(values('Not heavy.', TEAM_AND_WORKLOAD)['style.workloadTolerance']).toBe(0.25);
    expect(values('A team, but not heavy.', TEAM_AND_WORKLOAD)['style.workloadTolerance']).toBe(0.25);
  });

  it('reads lighter and average as before', () => {
    expect(values('Lighter please.', TEAM_AND_WORKLOAD)['style.workloadTolerance']).toBe(0.25);
    expect(values('Average.', TEAM_AND_WORKLOAD)['style.workloadTolerance']).toBe(0.5);
  });

  it('does not read heavy maths as a workload when workload was not asked', () => {
    expect(values('I like heavy maths.', ['interest'])['style.workloadTolerance']).toBeUndefined();
  });
});
