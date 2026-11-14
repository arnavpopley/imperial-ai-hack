// Ranking benchmark metrics (docs/ranking-benchmark.md). Pure functions over module id lists, so they can be
// unit tested and re-run against saved judge picks without any model calls.

export const K = 5;

/** Votes per module: how many judge samples put it in their top five. */
export type Votes = Record<string, number>;

/** One judge sample's ordered top five. */
export type JudgeSample = string[];

/**
 * Unions the samples into vote counts. Ties in the consensus order are broken by mean position across the
 * samples that picked the module, then by id, so the order is deterministic.
 */
export function tallyVotes(samples: readonly JudgeSample[]): { votes: Votes; consensus: string[] } {
  const votes: Votes = {};
  const positions: Record<string, number[]> = {};
  for (const sample of samples) {
    sample.forEach((id, index) => {
      votes[id] = (votes[id] ?? 0) + 1;
      (positions[id] ??= []).push(index + 1);
    });
  }
  const meanPosition = (id: string) => positions[id]!.reduce((a, b) => a + b, 0) / positions[id]!.length;
  const consensus = Object.keys(votes).sort((a, b) => votes[b]! - votes[a]! || meanPosition(a) - meanPosition(b) || a.localeCompare(b));
  return { votes, consensus };
}

/** Modules every sample picked: the judge's stable choices. */
export function firmPicks(votes: Votes, sampleCount: number): string[] {
  return Object.keys(votes).filter((id) => votes[id] === sampleCount);
}

/** Share of the engine's top k that the judge picked in at least one sample. */
export function precisionAtK(engine: readonly string[], votes: Votes, k = K): number {
  const top = engine.slice(0, k);
  return top.length === 0 ? 0 : top.filter((id) => (votes[id] ?? 0) > 0).length / k;
}

/**
 * Share of the judge's firm picks (chosen in every sample) that reach the engine's top k. When the samples
 * share no pick at all, every picked module counts, so the metric is always defined.
 */
export function recallAtK(engine: readonly string[], votes: Votes, sampleCount: number, k = K): number {
  const firm = firmPicks(votes, sampleCount);
  const relevant = firm.length > 0 ? firm : Object.keys(votes);
  if (relevant.length === 0) return 0;
  const top = new Set(engine.slice(0, k));
  return relevant.filter((id) => top.has(id)).length / relevant.length;
}

const discount = (rank: number) => 1 / Math.log2(rank + 1);

/** NDCG@k with the vote count as graded relevance (0, 1 or 2 for two samples), linear gain. */
export function ndcgAtK(engine: readonly string[], votes: Votes, k = K): number {
  const dcg = engine.slice(0, k).reduce((sum, id, i) => sum + (votes[id] ?? 0) * discount(i + 1), 0);
  const ideal = Object.values(votes)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, rel, i) => sum + rel * discount(i + 1), 0);
  return ideal === 0 ? 0 : dcg / ideal;
}

/**
 * Mean 1-based position of the judge's picks in the engine's full eligible list, weighted by votes, so a
 * module both samples chose counts twice. Lower is better; a random ranking of n modules averages (n + 1) / 2.
 */
export function meanJudgeRank(engine: readonly string[], votes: Votes): number {
  let weighted = 0;
  let total = 0;
  for (const [id, v] of Object.entries(votes)) {
    const rank = engine.indexOf(id);
    if (rank === -1) continue;
    weighted += (rank + 1) * v;
    total += v;
  }
  return total === 0 ? 0 : weighted / total;
}

/** Overlap between two judge samples' top fives, as a share of k: how consistent the judge is with itself. */
export function selfAgreement(samples: readonly JudgeSample[], k = K): number {
  if (samples.length < 2) return 1;
  const [a, b] = samples;
  const setB = new Set(b!.slice(0, k));
  return a!.slice(0, k).filter((id) => setB.has(id)).length / k;
}

export interface PersonaMetrics {
  precisionAt5: number;
  recallAt5: number;
  ndcgAt5: number;
  meanJudgeRank: number;
}

export function scoreRanking(engine: readonly string[], votes: Votes, sampleCount: number): PersonaMetrics {
  return {
    precisionAt5: precisionAtK(engine, votes),
    recallAt5: recallAtK(engine, votes, sampleCount),
    ndcgAt5: ndcgAtK(engine, votes),
    meanJudgeRank: meanJudgeRank(engine, votes),
  };
}

export function meanMetrics(rows: readonly PersonaMetrics[]): PersonaMetrics {
  const avg = (key: keyof PersonaMetrics) => (rows.length === 0 ? 0 : rows.reduce((s, r) => s + r[key], 0) / rows.length);
  return { precisionAt5: avg('precisionAt5'), recallAt5: avg('recallAt5'), ndcgAt5: avg('ndcgAt5'), meanJudgeRank: avg('meanJudgeRank') };
}

/** Mulberry32: a small seeded PRNG, so the random baseline is the same on every run. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Expected metrics for a uniformly random ranking of the same modules, by seeded Monte Carlo. */
export function randomBaseline(ids: readonly string[], votes: Votes, sampleCount: number, trials = 2000, seed = 42): PersonaMetrics {
  const next = prng(seed);
  const rows: PersonaMetrics[] = [];
  for (let t = 0; t < trials; t++) {
    const order = [...ids];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    rows.push(scoreRanking(order, votes, sampleCount));
  }
  return meanMetrics(rows);
}
