// "How it works" (spec 14, screen 12): a plain-English explainer, an animated flowchart of the agent process,
// the latest evaluation pass rates, and a live per-session trace of every decision and safety check.
import type { EvalRun, TraceEvent, TraceKind, Verdict } from '@modulematch/shared';
import { motion } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api.ts';
import { Badge, type BadgeTone } from '../components/Badge.tsx';
import { CountUp } from '../components/CountUp.tsx';
import { cx } from '../components/cx.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { AgentFlowchart } from './AgentFlowchart.tsx';
import { MiniFlow } from './MiniFlow.tsx';
import { AgentRoster } from './AgentRoster.tsx';
import { AGENTS, countWord } from './agents.ts';
import { LiveEvalPanel } from './LiveEvalPanel.tsx';
import { BenchmarkPanel } from './benchmark/BenchmarkPanel.tsx';
import { nodesInTrace } from './flow.ts';
import { labelCodes, noun } from './traceText.ts';
import { InfoTip } from '../components/InfoTip.tsx';

const SESSION_KEY = 'modulematch.sessionId';

function storedSessionId(): string {
  try {
    return localStorage.getItem(SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

const KIND_META: Record<TraceKind, { label: string; icon: IconName; dot: string }> = {
  mode: { label: 'Mode change', icon: 'swap', dot: 'bg-mode-plan text-on-brand' },
  agent: { label: 'Agent step', icon: 'sparkle', dot: 'bg-brand text-on-brand' },
  tool: { label: 'Engine call', icon: 'sliders', dot: 'bg-mode-explain text-on-brand' },
  guardrail: { label: 'Safety check', icon: 'shield', dot: 'bg-fit-mid text-on-brand' },
  escalation: { label: 'Handed to staff', icon: 'lifebuoy', dot: 'bg-mode-escalated text-on-brand' },
};

// Blocked and escalated share the danger tone, so the icon tells them apart as well as the label.
const VERDICT_META: Record<Verdict, { label: string; tone: BadgeTone; icon: IconName }> = {
  pass: { label: 'Passed', tone: 'success', icon: 'check' },
  redact: { label: 'Redacted', tone: 'warning', icon: 'eye-off' },
  block: { label: 'Blocked', tone: 'danger', icon: 'ban' },
  escalate: { label: 'Escalated', tone: 'danger', icon: 'user' },
};

/** What each evaluation measures, in plain words. Unknown names fall back to the raw name. */
const EVAL_COPY: Record<string, { title: string; question: string; icon: IconName }> = {
  'Ranking quality': {
    title: 'Good matches',
    question: 'For test students with known tastes, do the right modules reach their top five?',
    icon: 'grid',
  },
  Extraction: {
    title: 'Listening',
    question: 'Does the AI pick up what a student said, and store it in the right place?',
    icon: 'chat',
  },
  Guardrails: {
    title: 'Safety checks',
    question: 'Are off-topic, injected, sensitive and distressed messages all caught?',
    icon: 'shield',
  },
  Determinism: {
    title: 'Same answer every time',
    question: 'Does the same profile always produce exactly the same scores?',
    icon: 'reset',
  },
  'Privacy threshold': {
    title: 'Privacy',
    question: 'Are staff insights hidden when fewer than five students are behind them?',
    icon: 'lock',
  },
};

const rise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] },
} as const;

export function TraceApp() {
  const [sessionId, setSessionId] = useState(storedSessionId);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const load = useCallback(async (id: string) => {
    if (!id) {
      setEvents([]);
      return;
    }
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

  const seen = useMemo(() => nodesInTrace(events), [events]);
  // Whether the server calls the models, so the agent cards never claim a model that did not run (issue #115).
  const [live, setLive] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<{ live?: boolean }>) : null))
      .then((h) => setLive(h?.live), () => setLive(undefined));
  }, []);

  return (
    <div className="grid gap-section">
      <Intro />

      <section aria-labelledby="agents-heading" className="grid gap-6">
        <SectionHeading id="agents-heading" eyebrow="The AI agents" title={`${countWord(AGENTS.length)} agents, one job each`}>
          Each agent writes words, never numbers. Scores, rules and clashes come from plain code.
          {seen.size > 0 && ' A green outline marks the agents your session has used.'}
        </SectionHeading>
        <AgentRoster seen={seen} live={live} />
      </section>

      <section aria-labelledby="flow-heading" className="grid gap-6">
        <SectionHeading id="flow-heading" eyebrow="The process" title="What happens to one message">
          Every message takes this path. Hover or tap a step to see what it does.
          {seen.size > 0 && ' Green dots mark the steps your session has used.'}
        </SectionHeading>
        <AgentFlowchart seen={seen} />
      </section>

      <section aria-labelledby="eval-heading" className="grid gap-6">
        <SectionHeading id="eval-heading" eyebrow="Evaluation" title="How we test it">
          A fixed set of test cases runs offline on every build, and the real models were run against cases with known
          answers. Each number is the share that passed; the tick marks the target.
        </SectionHeading>
        <EvalPanel />
        <LiveEvalPanel />
        <BenchmarkPanel />
      </section>

      <section aria-labelledby="trace-heading" className="grid gap-6">
        <SectionHeading id="trace-heading" eyebrow="Live trace" title="Every decision for one session">
          A running log of what the AI did for a student, newest first, including each safety check and its verdict.
        </SectionHeading>
        <TracePanel sessionId={sessionId} onSessionId={setSessionId} events={events} state={state} />
      </section>
    </div>
  );
}

function Intro() {
  return (
    <motion.header {...rise} className="overflow-hidden rounded-panel bg-surface shadow-soft ring-1 ring-line">
      <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-center gap-4 p-card-lg sm:p-10">
          <p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">How it works</p>
          <h1 className="text-title">A team of small AI helpers, checked at every step</h1>
          <p className="max-w-xl text-base text-muted text-pretty">
            Numbers come from code; words come from the AI. This page shows the process, how we test it, and a live
            record of what it did for a session.
          </p>
        </div>
        {/* A message's path through the system, not a photo: the landing page has its own hero (issue #135). */}
        <MiniFlow className="border-t border-line bg-surface-2/50 px-4 py-6 sm:px-8 xl:border-t-0 xl:border-l" />
      </div>
      <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
        <Explainer icon="sparkle" title="The agents">
          Each agent has one job, from interviewing to searching the catalogue. A Supervisor picks which one replies.
        </Explainer>
        <Explainer icon="clock" title="A trace">
          A live log of every decision the AI made for a session, including each safety check and its verdict.
        </Explainer>
        <Explainer icon="check" title="The evaluation">
          Fixed test cases that measure match quality, listening, safety, consistency and privacy.
        </Explainer>
      </ul>
    </motion.header>
  );
}

function Explainer({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4 bg-surface p-card">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <h2 className="text-subheading">{title}</h2>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </li>
  );
}

function SectionHeading({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">{eyebrow}</p>
      <h2 id={id} className="flex items-center gap-1.5 text-heading">
        {title}
        <InfoTip label={`About ${title.toLowerCase()}`}>{children}</InfoTip>
      </h2>
    </div>
  );
}

function EvalPanel() {
  const [run, setRun] = useState<EvalRun | null | undefined>(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    api.latestEval().then(setRun, () => setError(true));
  }, []);

  if (error) return <p className="text-sm text-fit-low">Could not load the evaluation run.</p>;
  if (run === undefined) return <p className="text-sm text-muted">Loading evaluation…</p>;
  if (run === null)
    return (
      <p className="text-sm text-muted">The offline evaluation results are not available on this server.</p>
    );

  return (
    <div className="grid gap-4">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {run.results.map((r, i) => (
          <EvalCard key={r.name} result={r} index={i} />
        ))}
      </ul>
      <p className="text-xs text-muted">
        Run {new Date(run.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. Offline and deterministic, so it gives the same
        result every time.
      </p>
    </div>
  );
}

function EvalCard({ result: r, index }: { result: EvalRun['results'][number]; index: number }) {
  const rate = r.total ? r.passed / r.total : 0;
  const pct = Math.round(rate * 100);
  const ok = rate >= r.target;
  const copy = EVAL_COPY[r.name] ?? { title: r.name, question: '', icon: 'check' as const };
  const failing = r.details.filter((d) => !d.pass);
  const headingId = useId();
  return (
    <motion.li
      {...rise}
      transition={{ ...rise.transition, delay: index * 0.06 }}
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Icon name={copy.icon} size={20} />
        </span>
        <div className="min-w-0">
          <h3 id={headingId} className="font-semibold">
            {copy.title}
          </h3>
          <p className="text-xs text-muted">{r.name}</p>
        </div>
      </div>
      {copy.question && <p className="text-sm text-muted">{copy.question}</p>}
      <div className="mt-auto grid gap-2">
        <p className="flex items-baseline justify-between gap-3">
          <span className={cx('text-4xl font-semibold tracking-tight', ok ? 'text-fit-high' : 'text-fit-low')}>
            <CountUp value={pct} suffix="%" />
          </span>
          <Badge tone={ok ? 'success' : 'danger'} size="md">
            {ok ? 'Meets target' : 'Below target'}
          </Badge>
        </p>
        <div
          className="relative h-2.5 rounded-full bg-surface-2"
          role="img"
          aria-label={`${pct} percent passed, target ${Math.round(r.target * 100)} percent`}
        >
          <motion.div
            className={cx('h-full rounded-full', ok ? 'bg-fit-high' : 'bg-fit-low')}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          />
          <span
            aria-hidden="true"
            className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-ink/60"
            style={{ left: `calc(${r.target * 100}% - 1px)` }}
          />
        </div>
        <p className="text-xs text-muted">
          {r.passed} of {r.total} cases passed · target {Math.round(r.target * 100)}%
        </p>
      </div>
      {failing.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">{failing.length} failing cases</summary>
          <ul className="mt-2 grid gap-1.5">
            {failing.map((d) => (
              <li key={d.case}>
                <span className="font-medium">{d.case}</span>
                {d.note ? <span className="text-muted">: {d.note}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </motion.li>
  );
}

const FILTERS = ['all', 'guardrail', 'agent', 'tool', 'mode', 'escalation'] as const;
type Filter = (typeof FILTERS)[number];

function TracePanel({
  sessionId,
  onSessionId,
  events,
  state,
}: {
  sessionId: string;
  onSessionId: (id: string) => void;
  events: TraceEvent[];
  state: 'idle' | 'loading' | 'error';
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const inputId = useId();
  const mine = storedSessionId();

  // Newest first, so the latest verdicts are at the top during a live demo.
  const shown = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.kind === filter)).toReversed(),
    [events, filter],
  );
  const verdicts = useMemo(() => {
    const counts: Partial<Record<Verdict, number>> = {};
    for (const e of events) if (e.kind === 'guardrail' && e.verdict) counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
    return counts;
  }, [events]);

  return (
    <div className="grid gap-5 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            Session
          </label>
          <input
            id={inputId}
            className="min-w-0 rounded-xl border border-line bg-canvas px-4 py-2.5 font-mono text-sm"
            value={sessionId}
            onChange={(e) => onSessionId(e.target.value.trim())}
            placeholder="Paste a session id"
          />
        </div>
        {mine && mine !== sessionId && (
          <button
            type="button"
            onClick={() => onSessionId(mine)}
            className="h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface-2"
          >
            Use my session
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show only">
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={cx(
              'h-9 rounded-full px-4 text-sm font-medium transition-colors',
              filter === k ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted hover:text-ink',
            )}
          >
            {k === 'all' ? 'Everything' : KIND_META[k].label}
          </button>
        ))}
      </div>

      {events.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Summary">
          <li className="flex">
            <Badge size="md">
              <span className="tabular-nums">{events.length}</span> {noun(events.length, 'event')}
            </Badge>
          </li>
          {(Object.keys(VERDICT_META) as Verdict[]).map((v) =>
            verdicts[v] ? (
              <li key={v} className="flex">
                <Badge tone={VERDICT_META[v].tone} size="md" icon={VERDICT_META[v].icon} wrap>
                  <span className="tabular-nums">{verdicts[v]}</span> {noun(verdicts[v]!, 'safety check')}{' '}
                  {VERDICT_META[v].label.toLowerCase()}
                </Badge>
              </li>
            ) : null,
          )}
        </ul>
      )}

      {!sessionId ? (
        <p className="rounded-2xl bg-surface-2 p-5 text-sm text-muted">
          Start a session on the Student tab and it appears here, or paste a session id.
        </p>
      ) : state === 'error' ? (
        <p className="text-sm text-fit-low">Could not load the trace for this session.</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 p-5 text-sm text-muted">{state === 'loading' ? 'Loading…' : 'No events yet.'}</p>
      ) : (
        <Timeline events={shown} />
      )}
    </div>
  );
}

const PAGE = 20;

function Timeline({ events }: { events: TraceEvent[] }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = events.slice(0, limit);
  return (
    <div className="grid gap-4">
    <ol className="relative grid gap-3 before:absolute before:top-2 before:bottom-2 before:left-[1.125rem] before:w-px before:bg-line">
      {shown.map((e) => {
        const kind = KIND_META[e.kind];
        return (
          <motion.li
            key={e.id}
            layout="position"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-4"
          >
            <span aria-hidden="true" className={cx('relative grid size-9 place-items-center rounded-full ring-4 ring-surface', kind.dot)}>
              <Icon name={kind.icon} size={16} />
            </span>
            <div className="min-w-0 rounded-2xl bg-surface-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold capitalize">{e.actor}</span>
                <span className="text-xs text-muted">{kind.label}</span>
                {e.verdict && (
                  <Badge tone={VERDICT_META[e.verdict].tone} icon={VERDICT_META[e.verdict].icon}>
                    {VERDICT_META[e.verdict].label}
                  </Badge>
                )}
                <span className="ml-auto font-mono text-xs text-muted">
                  {new Date(e.at).toLocaleTimeString()} · {e.latencyMs} ms
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed break-words text-muted">
                <span className="text-ink">{labelCodes(e.input)}</span>
                {e.output && (
                  <>
                    {' '}
                    <span aria-hidden="true">→</span>
                    <span className="sr-only"> gave </span> {labelCodes(e.output)}
                  </>
                )}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
      {events.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="justify-self-center rounded-full bg-surface-2 px-5 py-2 text-sm font-medium hover:text-brand"
        >
          Show {Math.min(PAGE, events.length - limit)} older events ({events.length - limit} hidden)
        </button>
      )}
    </div>
  );
}
