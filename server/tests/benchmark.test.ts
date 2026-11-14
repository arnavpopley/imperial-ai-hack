// Ranking benchmark (docs/ranking-benchmark.md): metric maths, persona validity and the read-only route.
// Offline: nothing here calls the judge.
import { describe, expect, it } from 'vitest';
import {
  firmPicks,
  meanJudgeRank,
  ndcgAtK,
  precisionAtK,
  randomBaseline,
  recallAtK,
  selfAgreement,
  tallyVotes,
} from '../../scripts/benchmark/metrics.ts';
import { BENCHMARK_PERSONAS } from '../../scripts/benchmark/personas.ts';
import { createApp } from '../src/app.ts';
import { loadPathways } from '../src/db/catalogue.ts';
import { readDataset } from '../src/db/datasets.ts';
import { BenchmarkSummary } from '../src/routes/benchmark.ts';
import { z } from 'zod';

describe('benchmark metrics', () => {
  const samples = [
    ['a', 'b', 'c', 'd', 'e'],
    ['b', 'a', 'c', 'f', 'g'],
  ];
  const { votes, consensus } = tallyVotes(samples);

  it('unions samples into votes, ordering by votes then mean position', () => {
    expect(votes).toEqual({ a: 2, b: 2, c: 2, d: 1, e: 1, f: 1, g: 1 });
    expect(consensus.slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(consensus.slice(3)).toEqual(['d', 'f', 'e', 'g']);
    expect(firmPicks(votes, 2).sort()).toEqual(['a', 'b', 'c']);
  });

  it('scores a perfect, a partial and a disjoint engine ranking', () => {
    const perfect = ['a', 'b', 'c', 'd', 'e', 'x'];
    expect(precisionAtK(perfect, votes)).toBe(1);
    expect(recallAtK(perfect, votes, 2)).toBe(1);
    expect(ndcgAtK(perfect, votes)).toBeCloseTo(1);

    const partial = ['a', 'x', 'y', 'z', 'w', 'b', 'c'];
    expect(precisionAtK(partial, votes)).toBeCloseTo(0.2);
    expect(recallAtK(partial, votes, 2)).toBeCloseTo(1 / 3);
    expect(meanJudgeRank(partial, { a: 2, b: 2 })).toBeCloseTo((1 * 2 + 6 * 2) / 4);

    const disjoint = ['v', 'w', 'x', 'y', 'z'];
    expect(precisionAtK(disjoint, votes)).toBe(0);
    expect(ndcgAtK(disjoint, votes)).toBe(0);
  });

  it('falls back to every pick for recall when the samples share none', () => {
    const split = tallyVotes([['a'], ['b']]).votes;
    expect(recallAtK(['a', 'x', 'y', 'z', 'w'], split, 2)).toBeCloseTo(0.5);
  });

  it('measures judge self-agreement as top-five overlap', () => {
    expect(selfAgreement(samples)).toBeCloseTo(3 / 5);
  });

  it('gives a deterministic random baseline near the analytic value', () => {
    const ids = Array.from({ length: 31 }, (_, i) => `m${i}`);
    const v = { m0: 2, m1: 2, m2: 2, m3: 2, m4: 2 };
    const a = randomBaseline(ids, v, 2, 500, 7);
    expect(a).toEqual(randomBaseline(ids, v, 2, 500, 7));
    expect(a.precisionAt5).toBeCloseTo(5 / 31, 1);
    expect(a.meanJudgeRank).toBeCloseTo(16, 0);
  });
});

describe('benchmark personas', () => {
  const taxonomy = readDataset('taxonomy.json', z.object({ topics: z.record(z.string(), z.unknown()) })).topics;
  const pathways = new Set(loadPathways().map((p) => p.id));
  const fraction = (x: number | null) => x === null || (x >= 0 && x <= 1);

  it('has forty personas with unique ids and descriptions', () => {
    expect(BENCHMARK_PERSONAS).toHaveLength(40);
    expect(new Set(BENCHMARK_PERSONAS.map((p) => p.id)).size).toBe(40);
    for (const p of BENCHMARK_PERSONAS) expect(p.description.length).toBeGreaterThan(80);
  });

  it('uses only taxonomy topics, known pathways and values from 0 to 1', () => {
    for (const p of BENCHMARK_PERSONAS) {
      for (const [topic, strength] of Object.entries(p.interests)) {
        expect(taxonomy, `${p.id}: ${topic}`).toHaveProperty(topic);
        expect(fraction(strength)).toBe(true);
      }
      for (const id of p.pathways) expect(pathways.has(id), `${p.id}: ${id}`).toBe(true);
      expect(p.pathways.length).toBeLessThanOrEqual(3);
      expect(Object.values(p.style).every(fraction)).toBe(true);
      expect(fraction(p.breadthAppetite)).toBe(true);
    }
  });

  it('covers the traits the benchmark slices by', () => {
    const count = (t: string) => BENCHMARK_PERSONAS.filter((p) => p.traits.includes(t as never)).length;
    for (const t of ['strong', 'weak', 'breadth', 'exam-averse', 'null-style', 'contradictory', 'undecided']) expect(count(t)).toBeGreaterThan(0);
    for (const p of BENCHMARK_PERSONAS.filter((x) => x.traits.includes('null-style'))) {
      expect(Object.values(p.style).every((v) => v === null)).toBe(true);
    }
  });
});

describe('GET /api/eval/benchmark', () => {
  it('returns the headline numbers from the saved benchmark run', async () => {
    const res = await createApp().request('/api/eval/benchmark');
    expect(res.status).toBe(200);
    const body = BenchmarkSummary.parse(await res.json());
    expect(body.personasScored).toBe(40);
    expect(body.summary.engine.precisionAt5).toBeGreaterThan(body.summary.randomBaseline.precisionAt5);
    expect(body).not.toHaveProperty('personas');
  });
});
