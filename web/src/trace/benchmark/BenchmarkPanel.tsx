// Headline numbers from the independent ranking benchmark (docs/ranking-benchmark.md), read-only. An LLM
// playing a personal tutor picks five modules for each synthetic student from their words and the public
// module pages alone; these numbers say how closely the engine's top five matches, next to a random ranking.
import { useEffect, useState } from 'react';

interface Metrics {
  precisionAt5: number;
  recallAt5: number;
  ndcgAt5: number;
  meanJudgeRank: number;
}

interface BenchmarkSummary {
  at: string;
  judge: { model: string; effort: string; samplesPerPersona: number };
  k: number;
  eligibleModules: number;
  personasScored: number;
  summary: { engine: Metrics; randomBaseline: Metrics; judgeSelfAgreement: number };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATS: { key: keyof Metrics; label: string; hint: string; format: (x: number) => string }[] = [
  { key: 'precisionAt5', label: 'Picks the tutor agrees with', hint: 'precision@5', format: pct },
  { key: 'recallAt5', label: "Tutor's firm picks we find", hint: 'recall@5', format: pct },
  { key: 'ndcgAt5', label: 'Ranking quality', hint: 'NDCG@5, 0 to 1', format: (x) => x.toFixed(2) },
  { key: 'meanJudgeRank', label: "Where the tutor's picks sit", hint: 'mean rank, lower is better', format: (x) => x.toFixed(1) },
];

export function BenchmarkPanel() {
  const [data, setData] = useState<BenchmarkSummary | null | undefined>(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/eval/benchmark')
      .then((res) => (res.ok ? (res.json() as Promise<BenchmarkSummary | null>) : Promise.reject(new Error(String(res.status)))))
      .then(setData, () => setError(true));
  }, []);

  if (error) return <p className="text-sm text-fit-low">Could not load the ranking benchmark.</p>;
  if (data === undefined) return <p className="text-sm text-muted">Loading the ranking benchmark…</p>;
  if (data === null)
    return (
      <p className="text-sm text-muted">
        No ranking benchmark yet. Run <code className="font-mono">npm run benchmark</code>.
      </p>
    );

  const { engine, randomBaseline, judgeSelfAgreement } = data.summary;
  return (
    <div className="grid gap-4 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg">
      <div className="grid gap-1">
        <h3 className="font-semibold">Checked against an independent tutor</h3>
        <p className="max-w-2xl text-sm text-muted">
          For {data.personasScored} test students, an AI playing a personal tutor read only what the student said and
          the public module pages, never our tags or scores, and chose a top {data.k} from {data.eligibleModules}{' '}
          optional modules, twice. We compare our top {data.k} with its picks.
        </p>
      </div>
      <dl className="grid gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.key} className="grid gap-1 bg-surface-2 p-4">
            <dt className="text-sm font-medium">{s.label}</dt>
            <dd className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{s.format(engine[s.key])}</dd>
            <dd className="text-xs text-muted">
              {s.hint} · random {s.format(randomBaseline[s.key])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        The tutor agrees with itself {pct(judgeSelfAgreement)} of the time across its two tries, a rough ceiling. Judge{' '}
        {data.judge.model}, run {new Date(data.at).toLocaleDateString()}. Synthetic students; see
        docs/ranking-benchmark.md.
      </p>
    </div>
  );
}
