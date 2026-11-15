// How the live-model evaluation is summarised for the "How it works" page, checked on the committed run.
import { describe, expect, it } from 'vitest';
import committed from '../../../data/eval-live-latest.json';
import { groupLabel, modelName, summarise, type LiveEvalRun } from './liveEval.ts';

describe('live evaluation summary', () => {
  it('names models and groups the way the page shows them', () => {
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5');
    expect(modelName('claude-haiku-4-5')).toBe('Haiku 4.5');
    expect(modelName('claude-fable-5-1')).toBe('Fable 5.1');
    expect(modelName('some-other-model')).toBe('some-other-model');
    expect(groupLabel('Live: grounded explanations')).toBe('Grounded explanations');
  });

  it('marks each group against its target and lists every miss with its reason', () => {
    const run = committed as LiveEvalRun;
    const { groups, misses, met } = summarise(run);
    expect(groups).toHaveLength(run.results.length);
    for (const g of groups) expect(g.ok).toBe(g.passed / g.total >= g.target);
    expect(met).toBe(groups.filter((g) => g.ok).length);
    const failing = run.results.flatMap((r) => r.details.filter((d) => !d.pass));
    expect(misses).toHaveLength(failing.length);
    for (const m of misses) expect(m.note.length).toBeGreaterThan(0);
  });

  it('treats an empty group as not meeting its target', () => {
    const run: LiveEvalRun = { id: 'r', at: '2026-11-14T23:41:38.858Z', results: [{ name: 'Live: x', passed: 0, total: 0, target: 0.5, details: [] }] };
    expect(summarise(run).groups[0]!.ok).toBe(false);
  });
});
