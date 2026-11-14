// Trace and evaluation page (spec 14, screen 12): a per-session timeline of modes, agents, tools and guardrail
// verdicts, plus the latest evaluation pass rates.
import type { EvalRun, TraceEvent, TraceKind, Verdict } from '@modulematch/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.ts';

const SESSION_KEY = 'modulematch.sessionId';

function storedSessionId(): string {
  try {
    return localStorage.getItem(SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

const KIND_LABEL: Record<TraceKind, string> = {
  mode: 'Mode',
  agent: 'Agent',
  tool: 'Tool',
  guardrail: 'Guardrail',
  escalation: 'Escalation',
};

const VERDICT_STYLE: Record<Verdict, string> = {
  pass: 'bg-fit-high/15 text-fit-high',
  redact: 'bg-fit-mid/15 text-fit-mid',
  block: 'bg-fit-low/15 text-fit-low',
  escalate: 'bg-mode-escalated/15 text-mode-escalated',
};

const KIND_DOT: Record<TraceKind, string> = {
  mode: 'bg-mode-plan',
  agent: 'bg-brand',
  tool: 'bg-mode-explain',
  guardrail: 'bg-fit-mid',
  escalation: 'bg-mode-escalated',
};

function EvalPanel() {
  const [run, setRun] = useState<EvalRun | null | undefined>(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    api.latestEval().then(setRun, () => setError(true));
  }, []);

  if (error) return <p className="text-sm text-fit-low">Could not load the evaluation run.</p>;
  if (run === undefined) return <p className="text-sm text-muted">Loading evaluation…</p>;
  if (run === null) return <p className="text-sm text-muted">No evaluation run yet. Run <code className="font-mono">npm run eval</code>.</p>;

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted">Run {new Date(run.at).toLocaleString()} · offline, deterministic</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {run.results.map((r) => {
          const rate = r.total ? r.passed / r.total : 0;
          const ok = rate >= r.target;
          return (
            <li key={r.name} className="rounded-card border border-line bg-surface p-4">
              <p className="text-sm font-medium">{r.name}</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${ok ? 'text-fit-high' : 'text-fit-low'}`}>{Math.round(rate * 100)}%</p>
              <p className="text-xs text-muted">
                {r.passed}/{r.total} · target {Math.round(r.target * 100)}%
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${Math.round(rate * 100)} percent passed`}>
                <div className={`h-full ${ok ? 'bg-fit-high' : 'bg-fit-low'}`} style={{ width: `${rate * 100}%` }} />
              </div>
              {r.details.some((d) => !d.pass) && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted">{r.details.filter((d) => !d.pass).length} failing</summary>
                  <ul className="mt-1 grid gap-1">
                    {r.details
                      .filter((d) => !d.pass)
                      .map((d) => (
                        <li key={d.case}>
                          <span className="font-medium">{d.case}</span>
                          {d.note ? <span className="text-muted">: {d.note}</span> : null}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Timeline({ events }: { events: TraceEvent[] }) {
  return (
    <ol className="relative grid gap-2 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative rounded-card border border-line bg-surface p-3">
          <span className={`absolute -left-[1.6rem] top-4 size-2.5 rounded-full ring-4 ring-canvas ${KIND_DOT[e.kind]}`} aria-hidden />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{e.actor}</span>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">{KIND_LABEL[e.kind]}</span>
            {e.verdict && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLE[e.verdict]}`}>{e.verdict}</span>}
            <span className="ml-auto font-mono text-xs text-muted">
              {new Date(e.at).toLocaleTimeString()} · {e.latencyMs} ms
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="text-ink">{e.input}</span> → {e.output}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function TraceApp() {
  const [sessionId, setSessionId] = useState(storedSessionId);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [filter, setFilter] = useState<TraceKind | 'all'>('all');

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setState('loading');
    try {
      setEvents(await api.trace(id));
      setState('idle');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load(sessionId);
    // Refresh while the page is open so a live demo shows new verdicts as they happen.
    const timer = setInterval(() => void load(sessionId), 5000);
    return () => clearInterval(timer);
  }, [load, sessionId]);

  // Newest first, so the latest verdicts are at the top during a live demo.
  const shown = useMemo(() => (filter === 'all' ? events : events.filter((e) => e.kind === filter)).toReversed(), [events, filter]);
  const verdicts = useMemo(
    () => events.filter((e) => e.kind === 'guardrail').reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.verdict ?? 'none']: (acc[e.verdict ?? 'none'] ?? 0) + 1 }), {}),
    [events],
  );

  return (
    <div className="grid gap-8">
      <section aria-labelledby="eval-heading" className="grid gap-3">
        <h1 id="eval-heading" className="text-xl font-semibold tracking-tight">
          Evaluation
        </h1>
        <EvalPanel />
      </section>

      <section aria-labelledby="trace-heading" className="grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 id="trace-heading" className="text-xl font-semibold tracking-tight">
            Session trace
          </h2>
          <label className="ml-auto flex min-w-0 flex-1 items-center gap-2 text-sm sm:max-w-md">
            <span className="shrink-0 text-muted">Session</span>
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs focus:outline-2 focus:outline-brand"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.trim())}
              placeholder="Session id"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by kind">
          {(['all', 'mode', 'agent', 'tool', 'guardrail', 'escalation'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-sm ${filter === k ? 'bg-brand text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}
            >
              {k === 'all' ? 'All' : KIND_LABEL[k]}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-muted">
            {events.length} events · guardrails: {Object.entries(verdicts).map(([v, n]) => `${n} ${v}`).join(', ') || 'none yet'}
          </span>
        </div>
        {!sessionId ? (
          <p className="text-sm text-muted">Start a session on the Student tab, or paste a session id.</p>
        ) : state === 'error' ? (
          <p className="text-sm text-fit-low">Could not load the trace for this session.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">{state === 'loading' ? 'Loading…' : 'No events yet.'}</p>
        ) : (
          <Timeline events={shown} />
        )}
      </section>
    </div>
  );
}
