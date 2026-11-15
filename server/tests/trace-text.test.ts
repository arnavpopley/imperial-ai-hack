// Trace rows read cleanly: a long summary ends at a sentence or word with an ellipsis, never mid-word, and the
// Supervisor's intent is a plain label with its confidence (the trace-polish follow-up to issue #115).
import { INTENT_LABELS, intentLabel, schemas } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { createTracer, summarise } from '../src/trace/tracer.ts';

describe('trace summaries', () => {
  it('leave short text alone', () => {
    expect(summarise('all eligible')).toBe('all eligible');
  });

  it('end at the last sentence when it keeps at least half the room', () => {
    const text = 'MECH70015 Computational Fluid Dynamics is not open to MEng Mechanical Engineering year 3 students. You can ask the Senior Tutor.';
    const cut = summarise(text);
    expect(cut).toBe('MECH70015 Computational Fluid Dynamics is not open to MEng Mechanical Engineering year 3 students. …');
    expect(cut.length).toBeLessThanOrEqual(120);
  });

  it('otherwise end at a word, never mid-word, within the limit', () => {
    const text = `violation: ${'prerequisite '.repeat(20)}`;
    const cut = summarise(text, 60);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut).toMatch(/prerequisite…$/);
  });

  it('are applied to every recorded event', () => {
    const events: { output: string }[] = [];
    createTracer('s', (e) => events.push(e)).record({ actor: 'matcher', kind: 'tool', input: 'check_rules', output: 'word '.repeat(40), verdict: null });
    expect(events[0]!.output).toMatch(/word…$/);
    expect(events[0]!.output.length).toBeLessThanOrEqual(120);
  });
});

describe('intent labels', () => {
  it('name every intent the Supervisor can classify', () => {
    expect(Object.keys(INTENT_LABELS).sort()).toEqual([...schemas.Intent.options].sort());
  });

  it('read as words with the confidence as a percentage', () => {
    expect(intentLabel('rule_exception_request', 0.9)).toBe('Rule exception request · 90% sure');
    expect(intentLabel('smalltalk')).toBe('Small talk');
  });
});
