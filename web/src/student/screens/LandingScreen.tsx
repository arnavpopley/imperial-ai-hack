// The landing page: says plainly what ModuleMatch is, shows real people and the real product, and lays out
// how it answers the AI on Campus brief. Flat and spacious, with gentle motion that never stops the reader:
// drifting shapes behind the hero, photos that change on their own, and a slow photo strip.
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { HeroDemo } from '../landing/HeroDemo.tsx';
import { paths } from '../routes.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const RISE: Variants = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const STAGGER: Variants = { shown: { transition: { staggerChildren: 0.08 } } };
const IN_VIEW = { initial: 'hidden', whileInView: 'shown', viewport: { once: true, amount: 0.2 } } as const;

/** Set by the hero's Pause motion button: stops the slideshow, the photo strip and the drifting shapes. */
const MotionPaused = createContext(false);

/** True when the page should hold still: the reader asked for reduced motion, or pressed Pause motion. */
function useStill(): boolean {
  const reduce = useReducedMotion();
  const paused = useContext(MotionPaused);
  return Boolean(reduce) || paused;
}

interface Photo {
  src: string;
  alt: string;
}

const HERO_PHOTOS: readonly Photo[] = [
  { src: '/images/studying-together.jpg', alt: 'Two students working through notes on a laptop' },
  { src: '/images/tutor-one-to-one.jpg', alt: 'A tutor talking with a student' },
  { src: '/images/robotics-lab.jpg', alt: 'Students building a robot in a workshop' },
  { src: '/images/library-laptop.jpg', alt: 'A student working on a laptop in a library' },
];

const STRIP_PHOTOS: readonly Photo[] = [
  { src: '/images/campus-walk.jpg', alt: '' },
  { src: '/images/lecture-hall.jpg', alt: '' },
  { src: '/images/friends-campus.jpg', alt: '' },
  { src: '/images/planner-notebook.jpg', alt: '' },
  { src: '/images/hiking-society.jpg', alt: '' },
  { src: '/images/robotics-lab.jpg', alt: '' },
  { src: '/images/studying-together.jpg', alt: '' },
];

const HIGHLIGHTS: readonly { icon: IconName; title: string; text: string }[] = [
  { icon: 'chat', title: 'Tell it how you learn', text: 'Labs or lectures, exams or coursework, what you want to do next.' },
  { icon: 'grid', title: 'See why a module fits', text: 'Each reason points back to something you said.' },
  { icon: 'calendar', title: 'Sort out clashes early', text: 'Before term starts, not in week two.' },
];

/** The AI on Campus brief, level by level, with where each point lives in the app. */
const LEVELS: readonly { level: string; title: string; items: { text: string; to: string }[] }[] = [
  {
    level: 'Level 1',
    title: 'A real learning problem',
    items: [
      { text: 'Students pick modules on titles and rumour, not on how they learn', to: paths.start },
      { text: 'A short interview about interests, goals and learning style', to: paths.start },
      { text: 'Tailored exam feedback from the examiner’s notes', to: paths.start },
    ],
  },
  {
    level: 'Level 2',
    title: 'A working prototype',
    items: [
      { text: 'Live, streamed chat that knows where the interview is', to: paths.start },
      { text: 'Scores, prerequisites and credit rules enforced in code', to: paths.demo },
      { text: 'Eight safety checks on every message in and out', to: '/trace' },
    ],
  },
  {
    level: 'Level 3',
    title: 'Agents with a human in the loop',
    items: [
      { text: 'A supervisor routing specialised agents', to: '/trace' },
      { text: 'Mode switching as the conversation changes', to: '/trace' },
      { text: 'Hand-offs to staff, who can reply and override', to: '/staff' },
      { text: 'An evaluation suite run on every build', to: '/trace' },
    ],
  },
];

interface LandingScreenProps {
  /** Set when the student already has a session, so the main button resumes rather than starts. */
  resumeTo?: string;
}

export function LandingScreen({ resumeTo }: LandingScreenProps) {
  const cta = resumeTo ? { to: resumeTo, label: 'Continue where you left off' } : { to: paths.start, label: 'Get started' };
  const [paused, setPaused] = useState(false);

  return (
    <MotionPaused.Provider value={paused}>
      <div className="grid gap-24 pb-8 sm:gap-32">
        <Hero cta={cta} paused={paused} onTogglePaused={() => setPaused((p) => !p)} />
        <PhotoStrip />

        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <motion.div {...IN_VIEW} variants={STAGGER}>
            <motion.h2 variants={RISE} className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              A three-minute chat instead of a 200-page handbook
            </motion.h2>
            <motion.p variants={RISE} className="mt-4 text-lg text-muted">
              You talk, it listens, and the catalogue reorders itself around you.
            </motion.p>
            <motion.ul variants={STAGGER} className="mt-8 grid gap-5">
              {HIGHLIGHTS.map((h) => (
                <motion.li key={h.title} variants={RISE} className="flex gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Icon name={h.icon} size={22} />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold">{h.title}</span>
                    <span className="text-muted">{h.text}</span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
          <motion.div {...IN_VIEW} variants={RISE}>
            <HeroDemo />
          </motion.div>
        </section>

        <FeatureRow
          photo={{ src: '/images/tutor-one-to-one.jpg', alt: 'A tutor talking with a student' }}
          title="A person when it matters"
          text="If a question needs a human, like a rule exception or a worry, the advisor drafts a note for staff. You check it before it goes."
          link={{ to: '/staff', label: 'See the staff side' }}
        />
        <FeatureRow
          flip
          photo={{ src: '/images/robotics-lab.jpg', alt: 'Students building a robot in a workshop' }}
          title="Grounded in the real catalogue"
          text="Modules, descriptions and prerequisites come from the department’s published pages. The AI explains them; it never makes up a module or changes a score."
          link={{ to: '/trace', label: 'How it works' }}
        />

        <Challenge />

        <motion.section
          {...IN_VIEW}
          variants={RISE}
          className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-16 text-center text-on-brand sm:px-12 sm:py-20"
        >
          <DriftingShapes tone="on-brand" />
          <h2 className="relative text-3xl font-bold tracking-tight text-balance sm:text-5xl">Ready to pick your modules?</h2>
          <p className="relative mx-auto mt-4 max-w-md text-lg">Start with a quick chat, or look around with an example student first.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to={cta.to}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 text-base font-bold text-on-accent transition-transform hover:scale-[1.03]"
            >
              {cta.label}
              <Icon name="arrow-right" size={18} />
            </Link>
            <Link
              to={paths.demo}
              className="inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-bold ring-2 ring-on-brand/60 transition-colors hover:bg-on-brand/10"
            >
              See the demo
            </Link>
          </div>
        </motion.section>
      </div>
    </MotionPaused.Provider>
  );
}

function Hero({
  cta,
  paused,
  onTogglePaused,
}: {
  cta: { to: string; label: string };
  paused: boolean;
  onTogglePaused: () => void;
}) {
  return (
    <section className="relative -mx-4 -mt-8 overflow-hidden px-4 pt-14 pb-4 sm:-mx-6 sm:px-6 sm:pt-20 lg:-mx-8 lg:px-8">
      <DriftingShapes tone="brand" />
      <motion.div
        initial="hidden"
        animate="shown"
        variants={STAGGER}
        className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
      >
        <div>
          <motion.div variants={RISE} className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-on-accent">
              For Imperial students
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-muted ring-1 ring-line">
              <Icon name="globe" size={14} className="text-brand" />
              Coming to other universities
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-muted ring-1 ring-line">
              <Icon name="trophy" size={14} className="text-brand" />
              <span>
                2nd in the Reply track<span className="hidden sm:inline">, Imperial AI Hackathon</span>
              </span>
            </span>
          </motion.div>
          <motion.h1
            variants={RISE}
            className="mt-6 text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl"
          >
            Choose modules that suit how you learn.
          </motion.h1>
          <motion.p variants={RISE} className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
            ModuleMatch is an AI module advisor. Chat about what you enjoy and how you like to learn, and it ranks
            every module open to you, explains why, and flags clashes.
          </motion.p>
          <motion.div variants={RISE} className="mt-9 flex flex-wrap items-center gap-3">
            <Link to={cta.to} className={cx(buttonClass('primary'), 'h-14 rounded-full px-8 text-base font-bold')}>
              {cta.label}
              <Icon name="arrow-right" size={18} />
            </Link>
            <Link to={paths.demo} className={cx(buttonClass('secondary'), 'h-14 rounded-full px-7 text-base font-bold')}>
              See a demo
            </Link>
          </motion.div>
          <motion.p variants={RISE} className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Icon name="lock" size={14} />
            No sign-up. No grades or health questions.
          </motion.p>
        </div>
        <motion.div variants={RISE}>
          <PhotoCycle photos={HERO_PHOTOS} />
          {/* Moving content needs a way to stop it (WCAG 2.2.2): one button holds the whole page still. */}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onTogglePaused}
              aria-pressed={paused}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Icon name={paused ? 'play' : 'pause'} size={14} />
              {paused ? 'Play motion' : 'Pause motion'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/** Photos that change on their own every few seconds, with a crossfade. Still under reduced motion. */
function PhotoCycle({ photos }: { photos: readonly Photo[] }) {
  const reduce = useStill();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % photos.length), 4500);
    return () => clearInterval(timer);
  }, [reduce, photos.length]);
  const photo = photos[index]!;

  return (
    <div className="relative mx-auto aspect-[4/3.4] w-full max-w-xl">
      <div className="mm-photo absolute inset-0 overflow-hidden rounded-[2rem] shadow-lift">
        <AnimatePresence initial={false}>
          <motion.img
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.9 }, scale: { duration: 5, ease: 'linear' } }}
            className="absolute inset-0 size-full object-cover"
          />
        </AnimatePresence>
      </div>
      <div className="absolute -bottom-5 left-6 flex gap-1.5 rounded-full bg-surface px-3 py-2 shadow-soft" aria-hidden="true">
        {photos.map((p, i) => (
          <span
            key={p.src}
            className={cx('h-1.5 rounded-full transition-all duration-500', i === index ? 'w-6 bg-brand' : 'w-1.5 bg-line-strong')}
          />
        ))}
      </div>
    </div>
  );
}

/** A slow, endless strip of campus photos. Two copies of the row, so the loop has no seam. */
function PhotoStrip() {
  const still = useStill();
  const row = [...STRIP_PHOTOS, ...STRIP_PHOTOS];
  return (
    <div aria-hidden="true" className="-mx-4 overflow-hidden sm:-mx-6 lg:-mx-8">
      {/* pr-4 adds the gap after the last photo, so each copy (photos plus gaps) is exactly half the row and -50% loops seamlessly. */}
      <div
        className={cx(
          'flex w-max animate-marquee gap-4 pr-4 hover:[animation-play-state:paused]',
          still && '[animation-play-state:paused]',
        )}
      >
        {row.map((p, i) => (
          <img
            key={`${p.src}-${i}`}
            src={p.src}
            alt=""
            loading="lazy"
            className="h-44 w-64 shrink-0 rounded-3xl object-cover sm:h-52 sm:w-80"
          />
        ))}
      </div>
    </div>
  );
}

function FeatureRow({
  photo,
  title,
  text,
  link,
  flip = false,
}: {
  photo: Photo;
  title: string;
  text: string;
  link: { to: string; label: string };
  flip?: boolean;
}) {
  return (
    <motion.section
      {...IN_VIEW}
      variants={STAGGER}
      className="mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16"
    >
      <motion.div variants={RISE} className={cx('mm-photo overflow-hidden rounded-[2rem]', flip && 'md:order-last')}>
        <motion.img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="aspect-[4/3] w-full object-cover"
        />
      </motion.div>
      <motion.div variants={RISE}>
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="mt-4 text-lg text-muted">{text}</p>
        <Link to={link.to} className="mt-6 inline-flex items-center gap-1.5 text-base font-bold text-brand hover:underline">
          {link.label}
          <Icon name="arrow-right" size={16} />
        </Link>
      </motion.div>
    </motion.section>
  );
}

function Challenge() {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <motion.header {...IN_VIEW} variants={RISE} className="max-w-2xl">
        <p className="text-sm font-bold text-brand">Reply Student Tech Clash · AI on Campus</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">How it meets the brief</h2>
      </motion.header>
      <motion.ol {...IN_VIEW} variants={STAGGER} className="mt-10 grid gap-5 lg:grid-cols-3">
        {LEVELS.map((l) => (
          <motion.li key={l.level} variants={RISE} className="rounded-panel bg-surface p-card-lg shadow-soft ring-1 ring-line">
            <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">{l.level}</span>
            <h3 className="mt-4 text-xl font-bold tracking-tight">{l.title}</h3>
            <ul className="mt-5 grid gap-1">
              {l.items.map((item) => (
                <li key={item.text}>
                  <Link
                    to={item.to}
                    className="group -mx-2 flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2"
                  >
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-fit-high" />
                    <span className="flex-1">{item.text}</span>
                    <Icon
                      name="arrow-right"
                      size={16}
                      className="mt-1 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}

/** Soft shapes that drift slowly and endlessly behind a section; still under reduced motion. */
function DriftingShapes({ tone }: { tone: 'brand' | 'on-brand' }) {
  const reduce = useStill();
  const shapes = [
    { className: 'top-10 left-[6%] size-24 rounded-[2rem]', x: [0, 30, 0], y: [0, 20, 0], rotate: [0, 25, 0], duration: 18 },
    { className: 'top-1/3 right-[8%] size-16 rounded-full', x: [0, -24, 0], y: [0, 30, 0], rotate: [0, 0, 0], duration: 14 },
    { className: 'bottom-6 left-1/3 size-12 rounded-2xl', x: [0, 20, 0], y: [0, -24, 0], rotate: [0, -30, 0], duration: 16 },
    { className: 'top-6 right-1/3 size-10 rounded-full', x: [0, 16, 0], y: [0, 16, 0], rotate: [0, 0, 0], duration: 12 },
  ];
  const fill = tone === 'brand' ? ['bg-brand/10', 'bg-accent/40', 'bg-brand/15', 'bg-accent/30'] : ['bg-on-brand/10'];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {shapes.map((s, i) => (
        <motion.span
          key={i}
          className={cx('absolute', s.className, fill[i % fill.length])}
          animate={reduce ? { x: 0, y: 0, rotate: 0 } : { x: s.x, y: s.y, rotate: s.rotate }}
          transition={reduce ? { duration: 0.6 } : { duration: s.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

