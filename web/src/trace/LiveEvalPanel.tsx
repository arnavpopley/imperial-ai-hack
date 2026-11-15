// "With the live models": the latest `npm run eval:live` run, read-only. The real models answer cases with known
// answers and a stronger judge model grades the free-text ones. The run costs money, so it is committed and shown as
// it was, never re-run on a deploy.
import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '../components/cx.ts';
import { Icon } from '../components/Icon.tsx';
import { modelName, summarise, type LiveEvalRun } from './liveEval.ts';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function LiveEvalPanel() {
  const [run, setRun] = useState<LiveEvalRun | null | undefined>(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/eval/live')
      .then((res) => (res.ok ? (res.json() as Promise<LiveEvalRun | null>) : Promise.reject(new Error(String(res.status)))))
      .then(setRun, () => setError(true));
  }, []);

  if (error) return <p className="text-sm text-fit-low">Could not load the live-model evaluation.</p>;
  if (run === undefined) return <p className="text-sm text-muted">Loading the live-model evaluation…</p>;
  if (run === null)
    return (
      <p className="text-sm text-muted">
        No live-model run yet. Run <code className="font-mono">npm run eval:live</code>.
      </p>
    );

  const { groups, misses, met } = summarise(run);
  const models = run.models;
  return (
    <section aria-labelledby="live-eval-heading" className="grid gap-5 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-mode-explain text-on-brand shadow-soft">
            <Icon name="sparkle" size={20} />
          </span>
          <div>
            <h3 id="live-eval-heading" className="font-semibold">
              With the live models
            </h3>
            <p className="text-xs text-muted">
              {met} of {groups.length} groups meet their target
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-mode-plan/12 px-3 py-1 text-xs font-semibold text-mode-plan">
          <Icon name="clock" size={13} />
          Live run, not re-run on every deploy
        </span>
      </div>

      <ul aria-label="Run details" className="flex flex-wrap gap-2 text-xs">
        <Chip icon="calendar">{new Date(run.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Chip>
        {models && (
          <>
            <Chip icon="check" strong>
              Judge {modelName(models.judge)}
            </Chip>
            <Chip icon="chat">Answers {modelName(models.smart)}</Chip>
            <Chip icon="user">Extraction {modelName(models.fast)}</Chip>
            <Chip icon="shield">Classifiers {modelName(models.light)}</Chip>
          </>
        )}
      </ul>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {groups.map((g, i) => {
          const rate = g.total ? g.passed / g.total : 0;
          return (
            <motion.li
              key={g.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }}
              viewport={{ once: true, amount: 0.3 }}
              className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4"
            >
              {/* A long name may wrap; the score and bar sit at the bottom so tiles line up. */}
              <div className="mb-auto flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium">{g.label}</h4>
                <span
                  className={cx('grid size-6 shrink-0 place-items-center rounded-full', g.ok ? 'bg-fit-high/15 text-fit-high' : 'bg-fit-low/15 text-fit-low')}
                  title={g.ok ? 'Meets target' : 'Below target'}
                >
                  <Icon name={g.ok ? 'check' : 'x'} size={13} />
                  <span className="sr-only">{g.ok ? 'Meets target' : 'Below target'}</span>
                </span>
              </div>
              <p className={cx('text-3xl font-semibold tracking-tight tabular-nums', g.ok ? 'text-ink' : 'text-fit-low')}>
                {g.passed}
                <span className="text-lg text-muted">/{g.total}</span>
              </p>
              <div className="relative h-2 rounded-full bg-line" role="img" aria-label={`${pct(rate)} passed, target ${pct(g.target)}`}>
                <div className={cx('h-full rounded-full', g.ok ? 'bg-fit-high' : 'bg-fit-low')} style={{ width: pct(rate) }} />
                <span aria-hidden="true" className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink/60" style={{ left: `calc(${g.target * 100}% - 1px)` }} />
              </div>
              <p className="text-xs text-muted">target {pct(g.target)}</p>
            </motion.li>
          );
        })}
      </ul>

      {misses.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold tracking-[0.1em] text-muted uppercase">Misses, left visible</p>
          <ul className="grid gap-1.5 text-sm">
            {misses.map((m) => (
              // One line each; tapping, clicking or pressing Enter on the row opens the full reason.
              <li key={`${m.group}-${m.case}`}>
                <details className="group">
                  <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
                    <Icon name="x" size={13} className="shrink-0 text-fit-low" />
                    <span className="shrink-0 font-medium">{m.case}</span>
                    <span className="hidden shrink-0 text-xs text-muted sm:inline">{m.group}</span>
                    {m.note && <span className="min-w-0 flex-1 truncate text-muted group-open:invisible">{m.note}</span>}
                    {m.note && <Icon name="chevron-down" size={14} className="ml-auto shrink-0 text-muted transition-transform group-open:rotate-180" />}
                  </summary>
                  {m.note && <p className="mt-1 ml-5 text-muted">{m.note}</p>}
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Chip({ icon, strong, children }: { icon: 'calendar' | 'check' | 'chat' | 'user' | 'shield'; strong?: boolean; children: ReactNode }) {
  return (
    <li className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1', strong ? 'bg-brand-soft text-brand ring-brand/30' : 'bg-surface-2 text-muted ring-line')}>
      <Icon name={icon} size={12} />
      {children}
    </li>
  );
}
