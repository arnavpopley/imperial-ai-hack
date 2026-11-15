// /demo: open the real app as Rosa, an example student whose interview is already done, and explore it freely:
// the catalogue, the weights, a module's reasons, her timetable clash, the advisor and her data. startDemo restores
// her session (demoSession.ts) under a new id, so every visitor gets their own copy.
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { buttonClass } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { paths } from '../routes.ts';
import { useSession } from '../state/SessionProvider.tsx';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const TRY: readonly { icon: IconName; title: string; text: string }[] = [
  { icon: 'grid', title: 'Her ranked modules', text: 'Drag the weights and watch the order change.' },
  { icon: 'chat', title: 'Why a module fits', text: 'Open one and see each reason next to her own words.' },
  { icon: 'calendar', title: 'A real clash', text: 'Two of her picks meet at the same time. Try a swap.' },
  { icon: 'sparkle', title: 'Ask the advisor', text: '“Why is Embedded C first?” or “What if I drop coding?”' },
  { icon: 'lock', title: 'Her data', text: 'Every value, the quote behind it, and how to delete it.' },
];

const TAGS = ['Year 3 · MEng Mechanical', 'Robotics and control', 'Hands-on learner'];

export function DemoScreen() {
  const { startDemo, status, isDemo } = useSession();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replacesOwnSession = status === 'ready' && !isDemo;

  const open = async () => {
    setOpening(true);
    setError(null);
    try {
      await startDemo();
      navigate(paths.catalogue);
    } catch (err) {
      setError(errorMessage(err));
      setOpening(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 py-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <p className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">Interactive demo</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">Explore ModuleMatch as Rosa</h1>
        <p className="mt-4 max-w-lg text-lg text-muted">
          Rosa has already done her three-minute interview. Open her account and click around: everything works, and
          nothing you do affects anyone else.
        </p>

        <div className="mt-8 flex items-center gap-4 rounded-panel bg-surface p-5 shadow-soft ring-1 ring-line">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-brand text-xl font-bold text-on-brand"
          >
            R
          </span>
          <div className="min-w-0">
            <p className="font-bold">
              Rosa <span className="font-normal text-muted">(a made-up student)</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {TAGS.map((tag) => (
                <li key={tag} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void open()}
            disabled={opening}
            className={cx(buttonClass('primary'), 'h-14 rounded-full px-8 text-base font-bold')}
          >
            {opening ? 'Opening…' : 'Explore as Rosa'}
            <Icon name="arrow-right" size={18} />
          </button>
          <Link to={paths.start} className={cx(buttonClass('secondary'), 'h-14 rounded-full px-7 text-base font-bold')}>
            Start my own instead
          </Link>
        </div>
        {replacesOwnSession && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Icon name="info" size={14} />
            This replaces the session open in this browser.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-fit-low">
            The demo could not open: {error}
          </p>
        )}
      </motion.div>

      <motion.section
        aria-labelledby="demo-try"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        className="rounded-[2rem] bg-surface p-card-lg shadow-soft ring-1 ring-line"
      >
        <h2 id="demo-try" className="text-xl font-bold tracking-tight">
          Things to try
        </h2>
        <ul className="mt-5 grid gap-2">
          {TRY.map((t, i) => (
            <motion.li
              key={t.title}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: EASE }}
              className="flex items-start gap-4 rounded-2xl p-3 transition-colors hover:bg-surface-2"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon name={t.icon} size={20} />
              </span>
              <span>
                <span className="block font-semibold">{t.title}</span>
                <span className="text-sm text-muted">{t.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.section>
    </div>
  );
}
