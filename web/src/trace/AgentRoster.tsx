// "Meet the agents": one compact card per AI agent, grouped by who it serves, so the agents stand out before the
// full flowchart. Each card shows the model tier, the tools it calls and what it is never allowed to do, and lights
// up once the current session has used it. A legend maps every agent to its model tier.
import { motion } from 'motion/react';
// The roster has its own Badge (the agent's avatar), so the shared one is a Chip here.
import { Badge as Chip } from '../components/Badge.tsx';
import { cx } from '../components/cx.ts';
import { Icon } from '../components/Icon.tsx';
import { AGENTS, AUDIENCES, JUDGE, TIERS, type Agent, type Tier } from './agents.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const byAudience = (id: Agent['audience']) => AGENTS.filter((a) => a.audience === id);

/**
 * `live` says whether this server calls the models (from /api/health). Offline, every server agent answers from its
 * deterministic template, so its card says so instead of naming a model it did not use (issue #115).
 */
export function AgentRoster({ seen, live }: { seen: ReadonlySet<string>; live?: boolean }) {
  return (
    <div className="grid gap-6">
      {AUDIENCES.filter((a) => a.id === 'student').map((a) => (
        <Group key={a.id} label={a.label} agents={byAudience(a.id)} seen={seen} live={live} />
      ))}
      {/* Staff-facing and offline agents share a row, three cards wide like the student grid. */}
      <div className="grid gap-x-4 gap-y-6 lg:grid-cols-3">
        {AUDIENCES.filter((a) => a.id !== 'student').map((a) => {
          const agents = byAudience(a.id);
          return (
            <div key={a.id} className={cx(agents.length > 1 && 'lg:col-span-2')}>
              <Group label={a.label} agents={agents} seen={seen} live={live} />
            </div>
          );
        })}
      </div>
      <TierLegend live={live} />
    </div>
  );
}

function Group({ label, agents, seen, live }: { label: string; agents: readonly Agent[]; seen: ReadonlySet<string>; live?: boolean }) {
  return (
    <section aria-label={`${label} agents`} className="grid content-start gap-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-muted uppercase">
        {label}
        <Chip className="tracking-normal">{agents.length}</Chip>
      </h3>
      <ul className={cx('grid gap-4', agents.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : agents.length === 2 && 'sm:grid-cols-2')}>
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} used={seen.has(agent.id)} live={live} />
        ))}
      </ul>
    </section>
  );
}

function AgentCard({ agent, index, used, live }: { agent: Agent; index: number; used: boolean; live?: boolean }) {
  const tier = TIERS[agent.tier];
  // The Module Analyst is a batch job, so its model ran whatever mode this server is in.
  const template = live === false && agent.audience !== 'offline';
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
      <div aria-hidden="true" className={cx('h-1.5', agent.fill)} />
      <div className="flex flex-1 flex-col gap-3 p-card">
        <div className="flex items-center gap-3">
          <Badge agent={agent} size="md" />
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-semibold tracking-tight">{agent.name}</h4>
            {template ? (
              <Chip wrap title={`Runs on ${tier.model} when the models are switched on`} className="mt-0.5">
                {agent.offlineLabel ?? 'Template (offline)'}
                <span className="sr-only">; runs on {tier.model} when the models are switched on</span>
              </Chip>
            ) : (
              <Chip tone={tier.tone} className="mt-0.5">
                {tier.model}
              </Chip>
            )}
          </div>
          {used && (
            <Chip tone="success" dot className="self-start">
              {template ? 'Used (template)' : 'Used'}
            </Chip>
          )}
        </div>
        <p className="text-sm text-muted">{agent.does}</p>
        <ul aria-label="Tools" className="flex flex-wrap gap-1.5">
          {agent.tools.length === 0 ? (
            <li>
              <Chip>No tools, data only</Chip>
            </li>
          ) : (
            agent.tools.map((tool) => (
              <li key={tool}>
                <Chip icon="wrench" className={cx(tool.includes('_') && 'font-mono font-medium')}>
                  {tool}
                </Chip>
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
        'grid shrink-0 place-items-center text-on-brand shadow-soft',
        size === 'md' ? 'size-11 rounded-2xl' : 'size-7 rounded-lg',
        agent.fill,
      )}
    >
      <Icon name={agent.icon} size={size === 'md' ? 20 : 14} />
    </span>
  );
}

/** Which model each agent runs on, as rows of agent badges per tier. */
function TierLegend({ live }: { live?: boolean }) {
  return (
    <section aria-label="Model tiers" className="grid content-start gap-3">
      <h3 className="text-xs font-semibold tracking-[0.1em] text-muted uppercase">Model tiers</h3>
      {live === false && (
        <p className="text-sm text-muted">
          This server is offline: every agent answers from its template. These are the models it uses when they are on.
        </p>
      )}
      <ul className="grid gap-3 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line">
        {(Object.keys(TIERS) as Tier[]).map((id) => {
          const tier = TIERS[id];
          const agents = AGENTS.filter((a) => a.tier === id);
          return (
            <li key={id} className="flex flex-wrap items-center gap-3">
              <Chip tone={tier.tone} className="w-24 justify-center">
                {tier.model}
              </Chip>
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
          <Chip className="w-24 justify-center">{JUDGE.model}</Chip>
          <span className="text-xs text-muted">{JUDGE.use}, never talks to a student</span>
        </li>
      </ul>
    </section>
  );
}
