// The "How it works" hero (issue #135): one student message travelling through the system, played once. It
// passes the input checks, the Supervisor hands it to an agent, the output checks run, and a reply comes back.
// The full, interactive flowchart is further down the page; this is the one-line version. Static under
// prefers-reduced-motion. Badges and gradients are the agents' own, from agents.ts.
import { motion, useReducedMotion } from 'motion/react';
import { Fragment } from 'react';
import { cx } from '../components/cx.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { AGENTS } from './agents.ts';

const agent = (id: string) => AGENTS.find((a) => a.id === id);
const HELPERS = ['interviewer', 'matcher', 'timetabler'].flatMap((id) => agent(id) ?? []);
const SUPERVISOR = agent('supervisor');

interface Stop {
  key: string;
  label: string;
  icon: IconName;
  /** Badge colours: a gradient for agents, a soft tint for checks and the two ends. */
  tone: string;
}

const STOPS: readonly Stop[] = [
  { key: 'message', label: 'Your message', icon: 'chat', tone: 'bg-brand-soft text-brand' },
  { key: 'in', label: '4 checks in', icon: 'shield', tone: 'bg-fit-high/12 text-fit-high' },
  { key: 'supervisor', label: 'Supervisor', icon: SUPERVISOR?.icon ?? 'compass', tone: cx('bg-gradient-to-br text-on-brand', SUPERVISOR?.gradient) },
  { key: 'agent', label: 'One agent', icon: 'sparkle', tone: '' },
  { key: 'out', label: '4 checks out', icon: 'shield', tone: 'bg-fit-high/12 text-fit-high' },
  { key: 'reply', label: 'Reply', icon: 'send', tone: 'bg-brand-soft text-brand' },
];

const STEP = 0.32;
const START = 0.3;
const EASE = [0.2, 0.8, 0.2, 1] as const;

export function MiniFlow({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const at = (i: number) => (reduce ? { duration: 0 } : { duration: 0.35, delay: START + i * STEP, ease: EASE });

  return (
    <figure className={cx('grid content-center gap-4 xl:gap-6', className)}>
      <p aria-hidden="true" className="text-2xs font-semibold tracking-[0.1em] text-muted uppercase sm:text-center">
        One message, start to finish
      </p>
      <figcaption className="sr-only">
        A student message passes four input checks, the Supervisor hands it to one agent such as the Interviewer, the
        Matcher or the Timetabler, four output checks run, and the reply goes back to the student.
      </figcaption>
      {/* A column on phones, where six stops in a row would crowd their labels; a row from sm up. */}
      <ol aria-hidden="true" className="flex flex-col items-start sm:flex-row">
        {STOPS.map((stop, i) => (
          <Fragment key={stop.key}>
            {i > 0 && (
              // The connector fills in as the message reaches the next stop: downwards on phones, rightwards above.
              <li className="relative ml-[1.0625rem] h-3 w-0.5 shrink-0 overflow-hidden rounded-full bg-line sm:mt-[1.35rem] sm:ml-0 sm:h-0.5 sm:w-auto sm:min-w-1.5 sm:flex-1 xl:mt-6">
                <motion.span
                  className="absolute inset-0 origin-top-left rounded-full bg-brand"
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={at(i - 0.5)}
                />
              </li>
            )}
            <motion.li
              className="flex shrink-0 items-center gap-3 sm:w-16 sm:flex-col sm:gap-1.5 sm:text-center xl:w-[4.5rem]"
              initial={reduce ? false : { opacity: 0.35, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={at(i)}
            >
              {stop.key === 'agent' ? <AgentTrio /> : <Badge icon={stop.icon} tone={stop.tone} />}
              <span className="text-sm font-medium text-muted sm:text-2xs sm:leading-tight xl:text-xs">{stop.label}</span>
            </motion.li>
          </Fragment>
        ))}
      </ol>
      <motion.p
        aria-hidden="true"
        className="flex items-center gap-1.5 justify-self-start rounded-full bg-surface px-3 py-1 text-2xs font-medium text-muted ring-1 ring-line sm:justify-self-center"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={at(STOPS.length)}
      >
        <Icon name="lock" size={11} className="text-fit-high" />
        Scores, rules and clashes come from plain code
      </motion.p>
    </figure>
  );
}

function Badge({ icon, tone }: { icon: IconName; tone: string }) {
  return (
    <span className={cx('grid size-9 place-items-center rounded-xl shadow-soft sm:size-11 sm:rounded-2xl xl:size-12', tone)}>
      <Icon name={icon} size={18} />
    </span>
  );
}

/** The agent stop: three of the student-facing agents, stacked, since the Supervisor picks one of them. */
function AgentTrio() {
  return (
    <span className="relative grid size-9 place-items-center sm:size-11 xl:size-12">
      {HELPERS.map((a, i) => (
        <span
          key={a.id}
          className={cx(
            'absolute grid size-6 place-items-center rounded-lg bg-gradient-to-br text-on-brand shadow-soft ring-2 ring-surface sm:size-7',
            a.gradient,
          )}
          style={{ transform: `translate(${(i - 1) * 9}px, ${(i % 2) * 5 - 2}px)` }}
        >
          <Icon name={a.icon} size={12} />
        </span>
      ))}
    </span>
  );
}
