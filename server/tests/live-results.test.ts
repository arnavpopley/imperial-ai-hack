// The committed live-model evaluation (spec 18) and the read-only route the "How it works" page reads it from.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { latestLiveEval, LiveEvalRun } from '../src/routes/live-results.ts';

describe('live evaluation snapshot', () => {
  it('is committed, valid, and records the models it measured', () => {
    const run = latestLiveEval();
    expect(run).not.toBeNull();
    expect(run!.models).toEqual({ smart: 'claude-opus-5-5', fast: 'claude-sonnet-5-5', light: 'claude-haiku-4-5', judge: 'claude-fable-5-1' });
    for (const r of run!.results) {
      expect(r.passed).toBe(r.details.filter((d) => d.pass).length);
      expect(r.total).toBe(r.details.length);
    }
  });

  it('is served read-only at /api/eval/live', async () => {
    const res = await createApp().request('/api/eval/live');
    expect(res.status).toBe(200);
    const body = LiveEvalRun.parse(await res.json());
    expect(body.results.map((r) => r.name)).toContain('Live: module facts');
  });

  it('returns null when no run has been committed, and accepts runs without models', () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-eval-'));
    expect(latestLiveEval(join(dir, 'missing.json'))).toBeNull();
    const file = join(dir, 'old.json');
    writeFileSync(file, JSON.stringify({ id: 'r1', at: '2026-11-14T23:41:38.858Z', results: [] }));
    expect(latestLiveEval(file)?.models).toBeUndefined();
  });
});
