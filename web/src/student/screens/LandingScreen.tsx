// The landing page: one scrolling story of what ModuleMatch does, shown to a student before they start.
// Material-style cards with soft elevation, a colourful gradient field behind the hero, and short copy;
// sections rise into view as the student scrolls.
import { motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { AGENTS, countWord } from '../../trace/agents.ts';
import '../interview/interview.css';
import { paths } from '../routes.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const RISE: Variants = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const STAGGER: Variants = { shown: { transition: { staggerChildren: 0.09 } } };
/** Reveal a section once, when a fifth of it is on screen. */
const IN_VIEW = { initial: 'hidden', whileInView: 'shown', viewport: { once: true, amount: 0.2 } } as const;

const STEPS: readonly { icon: IconName; title: string; text: string; image: string; alt: string }[] = [
  {
    icon: 'chat',
    title: 'Chat for three minutes',
    text: 'An AI interviewer asks what you enjoy and where you are heading.',
    image: '/images/interview-conversation.jpg',
    alt: 'Two people in conversation',
  },
  {
    icon: 'grid',
    title: 'See every module ranked',
    text: 'A fit score for each module, with the reasons in your own words.',
    image: '/images/catalogue-study-group.jpg',
    alt: 'Students studying together',
  },
  {
    icon: 'calendar',
    title: 'Plan a week that works',
    text: 'Clashes are flagged, swaps suggested, and pathways tracked.',
    image: '/images/timetable-whiteboard.jpg',
    alt: 'A planning whiteboard',
  },
];

/** The agents a student talks to, and the ones that work behind the scenes (the same list as "How it works"). */
const FRONT = AGENTS.filter((a) => a.audience === 'student');
const BEHIND = AGENTS.filter((a) => a.audience !== 'student');
const BEHIND_LABEL = { staff: 'for staff', offline: 'offline', student: '' } as const;

const PROMISES: readonly { icon: IconName; title: string; text: string }[] = [
  { icon: 'shield', title: '8 safety checks', text: 'On every message in and every reply out.' },
  { icon: 'sliders', title: 'You set the weights', text: 'Drag a slider, watch the ranking move.' },
  { icon: 'lifebuoy', title: 'A person when it matters', text: 'Hard calls go to staff, with your approval.' },
  { icon: 'lock', title: 'Your data, your call', text: 'See, edit or delete everything we hold.' },
];

interface LandingScreenProps {
  /** True when the student already has a session, so the main button resumes rather than starts. */
  resumeTo?: string;
}

export function LandingScreen({ resumeTo }: LandingScreenProps) {
  const cta = resumeTo
    ? { to: resumeTo, label: 'Continue where you left off' }
    : { to: paths.start, label: 'Find my modules' };

  return (
    <div className="grid gap-24 pb-8 sm:gap-32">
      <Hero cta={cta} />

      <Section eyebrow="How it works" title="Three steps, one conversation">
        <motion.ol {...IN_VIEW} variants={STAGGER} className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              variants={RISE}
              className="group overflow-hidden rounded-panel bg-surface shadow-soft ring-1 ring-line transition-shadow duration-300 hover:shadow-lift"
            >
              <div className="mm-photo relative h-44 overflow-hidden">
                <img
                  src={step.image}
                  alt={step.alt}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-surface text-sm font-semibold shadow-soft">
                  {i + 1}
                </span>
              </div>
              <div className="p-card">
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Icon name={step.icon} size={18} className="text-brand" />
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted">{step.text}</p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </Section>

      <Section eyebrow="Under the hood" title={`${countWord(AGENTS.length)} AI agents, kept in check by plain code`}>
        <motion.ul {...IN_VIEW} variants={STAGGER} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FRONT.map((agent) => (
            <motion.li
              key={agent.id}
              variants={RISE}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="flex items-center gap-4 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line"
            >
              <AgentBadge gradient={agent.gradient} icon={agent.icon} />
              <div className="min-w-0">
                <h3 className="font-semibold tracking-tight">{agent.name}</h3>
                <p className="mt-0.5 text-sm text-muted">{agent.does}</p>
              </div>
            </motion.li>
          ))}
          <motion.li variants={RISE} className="grid content-center gap-2.5 rounded-panel bg-surface-2/70 p-card ring-1 ring-line">
            <p className="text-xs font-semibold tracking-[0.1em] text-muted uppercase">Behind the scenes</p>
            {BEHIND.map((agent) => (
              <p key={agent.id} className="flex items-center gap-2.5 text-sm">
                <AgentBadge gradient={agent.gradient} icon={agent.icon} small />
                <span className="font-medium">{agent.name}</span>
                <span className="text-muted">{BEHIND_LABEL[agent.audience]}</span>
              </p>
            ))}
          </motion.li>
        </motion.ul>
        <motion.div {...IN_VIEW} variants={RISE} className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span className="flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 ring-1 ring-line">
            <Icon name="lock" size={14} className="text-fit-high" />
            Scores, rules and clashes are plain code. No agent can change a number.
          </span>
          <Link to="/trace" className="flex items-center gap-1.5 font-medium text-brand hover:underline">
            Watch a message flow through
            <Icon name="arrow-right" size={14} />
          </Link>
        </motion.div>
      </Section>

      <Section eyebrow="Built on trust" title="Advice you can check">
        <motion.ul {...IN_VIEW} variants={STAGGER} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <motion.li key={p.title} variants={RISE} className="rounded-panel bg-surface-2/70 p-card ring-1 ring-line">
              <Icon name={p.icon} size={22} className="text-brand" />
              <h3 className="mt-3 font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.text}</p>
            </motion.li>
          ))}
        </motion.ul>
      </Section>

      <motion.section
        {...IN_VIEW}
        variants={RISE}
        className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-mode-explain to-mode-plan px-6 py-14 text-center text-on-brand shadow-lift sm:px-12 sm:py-20"
      >
        <GlowField className="opacity-40 mix-blend-overlay" />
        <h2 className="relative text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Your next year, matched to you.
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-on-brand/85">Three minutes now saves a term of second-guessing.</p>
        <Link
          to={cta.to}
          className="relative mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-surface px-8 text-base font-semibold text-ink shadow-lift transition hover:scale-[1.03]"
        >
          {cta.label}
          <Icon name="arrow-right" size={18} />
        </Link>
      </motion.section>
    </div>
  );
}

function Hero({ cta }: { cta: { to: string; label: string } }) {
  return (
    <section className="relative -mx-4 -mt-8 overflow-hidden px-4 pt-14 pb-6 sm:-mx-6 sm:px-6 sm:pt-20 lg:-mx-8 lg:px-8">
      <GlowField />
      <motion.div
        initial="hidden"
        animate="shown"
        variants={STAGGER}
        className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div>
          <motion.p
            variants={RISE}
            className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3.5 py-1.5 text-xs font-medium text-muted shadow-soft ring-1 ring-line backdrop-blur"
          >
            <span className="size-2 animate-pulse-dot rounded-full bg-fit-high" />
            AI module advisor for Imperial students
          </motion.p>
          <motion.h1
            variants={RISE}
            className="mt-6 text-[2.75rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-[4.25rem]"
          >
            Choose modules{' '}
            <span className="bg-gradient-to-r from-brand via-mode-explain to-mode-plan bg-clip-text text-transparent">
              that fit you
            </span>
            .
          </motion.h1>
          <motion.p variants={RISE} className="mt-5 max-w-lg text-lg text-muted">
            A short chat, a ranked catalogue, a clash-free week. Every score is explained.
          </motion.p>
          <motion.div variants={RISE} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={cta.to}
              className={cx(buttonClass('primary'), 'h-14 rounded-full px-7 text-base shadow-lift hover:scale-[1.03]')}
            >
              {cta.label}
              <Icon name="arrow-right" size={18} />
            </Link>
            <Link to="/trace" className={cx(buttonClass('secondary'), 'h-14 rounded-full px-6 text-base')}>
              <Icon name="sparkle" size={16} className="text-brand" />
              How it works
            </Link>
          </motion.div>
        </div>
        <HeroVisual />
      </motion.div>
    </section>
  );
}

/** Photo card with floating result chips, previewing what the student gets. */
function HeroVisual() {
  return (
    <motion.div variants={RISE} className="relative mx-auto w-full max-w-lg">
      <div className="mm-photo overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-line">
        <img
          src="/images/hero-students-steps.jpg"
          alt="Students sitting together on campus steps"
          className="h-80 w-full object-cover sm:h-[26rem]"
        />
      </div>
      <FloatingChip className="-left-4 top-8 sm:-left-10" delay={0.5}>
        <span className="grid size-10 place-items-center rounded-xl bg-fit-high/15 text-lg font-semibold text-fit-high">92</span>
        <span>
          <span className="block text-sm font-semibold">Mechatronics</span>
          <span className="block text-xs text-muted">Strong fit for you</span>
        </span>
      </FloatingChip>
      <FloatingChip className="-right-3 top-1/2 sm:-right-8" delay={0.7}>
        <span className="grid size-10 place-items-center rounded-xl bg-mode-plan/15 text-mode-plan">
          <Icon name="calendar" size={18} />
        </span>
        <span className="text-sm font-semibold">No clashes</span>
      </FloatingChip>
      <FloatingChip className="bottom-6 left-6" delay={0.9}>
        <span className="grid size-10 place-items-center rounded-xl bg-mode-explain/15 text-mode-explain">
          <Icon name="chat" size={18} />
        </span>
        <span className="max-w-[12rem] text-xs text-muted">
          &ldquo;I loved the control systems lab&rdquo;
        </span>
      </FloatingChip>
    </motion.div>
  );
}

function FloatingChip({ className, delay, children }: { className: string; delay: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: [0, -6, 0], scale: 1 }}
      transition={{
        opacity: { delay, duration: 0.5 },
        scale: { delay, duration: 0.5, ease: EASE },
        y: { delay: delay + 0.5, duration: 5, repeat: Infinity, ease: 'easeInOut' },
      }}
      className={cx(
        'absolute flex items-center gap-3 rounded-2xl bg-surface/95 p-2.5 pr-4 shadow-lift ring-1 ring-line backdrop-blur',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

/** Soft colour blobs behind a section, from the theme's brand and mode colours. */
function GlowField({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute inset-0 overflow-hidden',
        // Fade the glow out towards every edge so it never shows a hard border.
        '[mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]',
        className,
      )}
    >
      <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-brand/25 blur-3xl" />
      <div className="absolute top-10 right-[-6rem] size-[24rem] rounded-full bg-mode-explain/25 blur-3xl" />
      <div className="absolute bottom-[-10rem] left-1/3 size-[26rem] rounded-full bg-mode-plan/20 blur-3xl" />
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <motion.header {...IN_VIEW} variants={RISE} className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      </motion.header>
      {children}
    </section>
  );
}

/** An agent's icon on its gradient, the same badge as on the "How it works" roster. */
function AgentBadge({ gradient, icon, small }: { gradient: string; icon: IconName; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center bg-gradient-to-br text-on-brand shadow-soft',
        small ? 'size-7 rounded-lg' : 'size-12 rounded-2xl',
        gradient,
      )}
    >
      <Icon name={icon} size={small ? 14 : 22} />
    </span>
  );
}
