// "Meet the agents": one colourful card per AI agent, so the agents stand out before the full flowchart.
// Each card says what the agent does and what it is never allowed to do, and lights up once the
// current session has used it.
import { motion } from 'motion/react';
import { cx } from '../components/cx.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import type { NodeId } from './flow.ts';

interface Agent {
  id: NodeId;
  name: string;
  icon: IconName;
  does: string;
  /** Finishes the sentence "Never ...". */
  never: string;
  /** Gradient for the card's badge, from the theme's mode colours. */
  gradient: string;
  /** Text and soft background for the "never" line. */
  tone: string;
}

const AGENTS: readonly Agent[] = [
  {
    id: 'supervisor',
    name: 'Supervisor',
    icon: 'compass',
    does: 'Reads each message and picks which agent replies.',
    never: 'answers the student itself.',
    gradient: 'from-brand to-mode-explain',
    tone: 'text-brand',
  },
  {
    id: 'interviewer',
    name: 'Interviewer',
    icon: 'chat',
    does: 'Asks the next most useful question.',
    never: 'asks about grades or health.',
    gradient: 'from-mode-interview to-mode-plan',
    tone: 'text-mode-interview',
  },
  {
    id: 'extractor',
    name: 'Profile Extractor',
    icon: 'user',
    does: 'Turns answers into a profile, tied to your quotes.',
    never: 'stores anything without a source quote.',
    gradient: 'from-mode-explain to-mode-escalated',
    tone: 'text-mode-explain',
  },
  {
    id: 'matcher',
    name: 'Matcher',
    icon: 'sparkle',
    does: 'Explains each ranked module with evidence.',
    never: 'changes a fit score.',
    gradient: 'from-mode-recommend to-mode-plan',
    tone: 'text-mode-recommend',
  },
  {
    id: 'timetabler',
    name: 'Timetabler',
    icon: 'calendar',
    does: 'Explains clashes and the cheapest swaps.',
    never: 'overrides a programme rule.',
    gradient: 'from-mode-plan to-mode-interview',
    tone: 'text-mode-plan',
  },
];

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function AgentRoster({ seen }: { seen: ReadonlySet<NodeId> }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {AGENTS.map((agent, i) => {
        const used = seen.has(agent.id);
        return (
          <motion.li
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
            whileHover={{ y: -6 }}
            className={cx(
              'relative flex flex-col overflow-hidden rounded-panel bg-surface shadow-soft ring-1 transition-shadow hover:shadow-lift',
              used ? 'ring-fit-high/60' : 'ring-line',
            )}
          >
            <div aria-hidden="true" className={cx('h-1.5 bg-gradient-to-r', agent.gradient)} />
            <div className="flex flex-1 flex-col p-card">
              <div className="flex items-start justify-between gap-2">
                <span
                  aria-hidden="true"
                  className={cx(
                    'grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-on-brand shadow-soft',
                    agent.gradient,
                  )}
                >
                  <Icon name={agent.icon} size={26} />
                </span>
                {used && (
                  <span className="flex items-center gap-1 rounded-full bg-fit-high/12 px-2 py-0.5 text-[11px] font-semibold text-fit-high">
                    <span className="size-1.5 rounded-full bg-fit-high" />
                    Used
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{agent.name}</h3>
              <p className="mt-1 text-sm text-muted">{agent.does}</p>
              <p className="mt-auto flex items-start gap-1.5 pt-4 text-xs font-medium">
                <Icon name="ban" size={13} className={cx('mt-0.5 shrink-0', agent.tone)} />
                <span>
                  <span className={agent.tone}>Never</span> {agent.never}
                </span>
              </p>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
