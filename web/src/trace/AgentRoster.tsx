// "Meet the agents": one compact card per AI agent, grouped by who it serves, so the agents stand out before the
// full flowchart. Each card shows the model tier, the tools it calls and what it is never allowed to do, and lights
// up once the current session has used it. A legend maps every agent to its model tier.
import { motion } from 'motion/react';
import { cx } from '../components/cx.ts';
import { Icon } from '../components/Icon.tsx';
import { AGENTS, AUDIENCES, JUDGE, TIERS, type Agent, type Tier } from './agents.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const byAudience = (id: Agent['audience']) => AGENTS.filter((a) => a.audience === id);

export function AgentRoster({ seen }: { seen: ReadonlySet<string> }) {
  return (
    <div className="grid gap-6">
      {AUDIENCES.filter((a) => a.id === 'student').map((a) => (
        <Group key={a.id} label={a.label} agents={byAudience(a.id)} seen={seen} />
      ))}
      {/* Staff-facing and offline agents share a row, three cards wide like the student grid. */}
      <div className="grid gap-x-4 gap-y-6 lg:grid-cols-3">
        {AUDIENCES.filter((a) => a.id !== 'student').map((a) => {
          const agents = byAudience(a.id);
          return (
            <div key={a.id} className={cx(agents.length > 1 && 'lg:col-span-2')}>
              <Group label={a.label} agents={agents} seen={seen} />
            </div>
          );
        })}
      </div>
      <TierLegend />
    </div>
  );
}

function Group({ label, agents, seen }: { label: string; agents: readonly Agent[]; seen: ReadonlySet<string> }) {
  return (
    <section aria-label={`${label} agents`} className="grid content-start gap-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-muted uppercase">
        {label}
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] tracking-normal text-ink ring-1 ring-line">{agents.length}</span>
      </h3>
      <ul className={cx('grid gap-4', agents.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : agents.length === 2 && 'sm:grid-cols-2')}>
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} used={seen.has(agent.id)} />
        ))}
      </ul>
    </section>
  );
}

function AgentCard({ agent, index, used }: { agent: Agent; index: number; used: boolean }) {
  const tier = TIERS[agent.tier];
  return (
    <motion.li
      initial={{ opacity: 0, y: 20 }}
      // The stagger delay belongs to the entrance only, so hovering in and out responds at once.
      whileInView={{ opacity: 1, y: 0, transition: { delay: index * 0.06, duration: 0.5, ease: EASE } }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -5 }}
      className={cx(
        'relative flex flex-col overflow-hidden rounded-panel bg-surface shadow-soft ring-1 transition-shadow hover:shadow-lift',
        used ? 'ring-fit-high/60' : 'ring-line',
      )}
    >
      <div aria-hidden="true" className={cx('h-1.5 bg-gradient-to-r', agent.gradient)} />
      <div className="flex flex-1 flex-col gap-3 p-card">
        <div className="flex items-center gap-3">
          <Badge agent={agent} size="md" />
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-semibold tracking-tight">{agent.name}</h4>
            <span className={cx('mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', tier.chip)}>{tier.model}</span>
          </div>
          {used && (
            <span className="flex shrink-0 items-center gap-1 self-start rounded-full bg-fit-high/12 px-2 py-0.5 text-[11px] font-semibold text-fit-high">
              <span className="size-1.5 rounded-full bg-fit-high" />
              Used
            </span>
          )}
        </div>
        <p className="text-sm text-muted">{agent.does}</p>
        <ul aria-label="Tools" className="flex flex-wrap gap-1.5">
          {agent.tools.length === 0 ? (
            <li className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">No tools, data only</li>
          ) : (
            agent.tools.map((tool) => (
              <li
                key={tool}
                className={cx(
                  'flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] ring-1 ring-line',
                  tool.includes('_') && 'font-mono',
                )}
              >
                <Icon name="wrench" size={10} className="text-muted" />
                {tool}
              </li>
            ))
          )}
        </ul>
        <p className="mt-auto flex items-start gap-1.5 text-xs font-medium">
          <Icon name="ban" size={13} className={cx('mt-0.5 shrink-0', agent.tone)} />
          <span>
            <span className="font-semibold">Never</span> {agent.never}
          </span>
        </p>
      </div>
    </motion.li>
  );
}

function Badge({ agent, size }: { agent: Agent; size: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center bg-gradient-to-br text-on-brand shadow-soft',
        size === 'md' ? 'size-11 rounded-2xl' : 'size-7 rounded-lg',
        agent.gradient,
      )}
    >
      <Icon name={agent.icon} size={size === 'md' ? 20 : 14} />
    </span>
  );
}

/** Which model each agent runs on, as rows of agent badges per tier. */
function TierLegend() {
  return (
    <section aria-label="Model tiers" className="grid content-start gap-3">
      <h3 className="text-xs font-semibold tracking-[0.1em] text-muted uppercase">Model tiers</h3>
      <ul className="grid gap-3 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line">
        {(Object.keys(TIERS) as Tier[]).map((id) => {
          const tier = TIERS[id];
          const agents = AGENTS.filter((a) => a.tier === id);
          return (
            <li key={id} className="flex flex-wrap items-center gap-3">
              <span className={cx('w-24 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold', tier.chip)}>{tier.model}</span>
              <span className="w-36 text-xs text-muted">{tier.use}</span>
              <span className="flex flex-wrap gap-1.5">
                {agents.map((a) => (
                  <span key={a.id} title={a.name} className="flex">
                    <Badge agent={a} size="sm" />
                    <span className="sr-only">{a.name}</span>
                  </span>
                ))}
              </span>
            </li>
          );
        })}
        <li className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span className="w-24 rounded-full bg-surface-2 px-2 py-0.5 text-center text-[11px] font-semibold ring-1 ring-line">{JUDGE.model}</span>
          <span className="text-xs text-muted">{JUDGE.use}, never talks to a student</span>
        </li>
      </ul>
    </section>
  );
}
