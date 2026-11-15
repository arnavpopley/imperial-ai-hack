// Optional step: societies and clubs that match the interests heard so far.
import type { Society } from '@modulematch/shared';
import { motion } from 'motion/react';
import { useEffect, useId } from 'react';
import { api } from '../../api.ts';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { Meter } from '../../components/Meter.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { Spinner } from '../../components/Spinner.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { artFor, artForTopic } from '../societies/SocietyArt.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

interface SocietiesPanelProps {
  onSeen: () => void;
  onClose: () => void;
}

const SHOWN = 4;

export function SocietiesPanel({ onSeen, onClose }: SocietiesPanelProps) {
  const { session } = useReadySession();
  const headingId = useId();
  // Any profile change (a new answer, an edit) can move the matches, so reload whenever the profile is saved.
  const matches = useAsync(() => api.societyMatches(session.id), [session.id, session.profile.updatedAt]);
  const societies = useAsync(() => api.societies(), []);
  const byId = new Map((societies.data ?? []).map((s) => [s.id, s]));
  const names = new Map((societies.data ?? []).map((s) => [s.id, s.name]));
  const top = (matches.data ?? []).slice(0, SHOWN);
  const loaded = matches.data !== undefined;
  const { softEnter, transition } = useMotionTokens();
  /** Errors and the empty state arrive softly, with no shake or flash. */
  const gentle = softEnter('answerFeedback', 4);

  useEffect(() => {
    if (loaded) onSeen();
  }, [loaded, onSeen]);

  return (
    <section aria-labelledby={headingId} className="grid gap-5">
      {/* The pathways page has the societies photo; this panel shows the student's top matches' own artwork, so no
          photo appears twice (issue #135). */}
      <div className="relative h-36 overflow-hidden rounded-2xl bg-gradient-to-br from-art-1 via-art-4 to-art-6 sm:h-44">
        <MatchArt societies={top.map((m) => byId.get(m.societyId))} />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-surface/90 text-ink shadow-soft backdrop-blur transition hover:bg-surface"
        >
          <Icon name="x" size={16} label="Close societies panel" />
        </button>
      </div>
      <div>
        <h2 id={headingId} className="text-heading">
          Societies and clubs
        </h2>
        <p className="mt-1 text-sm text-muted">Picked from the interests you have shared so far.</p>
      </div>

      {matches.loading && !loaded ? (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner size={16} /> Finding your people…
        </p>
      ) : matches.error ? (
        <motion.p role="alert" {...gentle} className="flex flex-wrap items-center gap-2 text-xs text-fit-low">
          Societies did not load.
          <button type="button" onClick={matches.reload} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </motion.p>
      ) : top.length === 0 ? (
        <motion.p {...gentle} className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Tell me a few interests first and matching societies will appear here.
        </motion.p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {top.map((match, i) => {
            const name = names.get(match.societyId) ?? match.societyId;
            return (
              <motion.li
                key={match.societyId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition('lessonTransition', i * 0.07)}
                className="grid gap-2.5 rounded-2xl border border-line bg-surface p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold leading-snug">{name}</span>
                  {match.wildcard && (
                    <span className="shrink-0 rounded-full bg-mode-explain/12 px-2 py-0.5 text-2xs font-semibold text-mode-explain">
                      Wildcard
                    </span>
                  )}
                </div>
                <Meter value={match.fit / 100} label={`Fit with ${name}`} valueText={`${match.fit}%`} />
                <p className="text-xs leading-snug text-muted">{match.reason}</p>
              </motion.li>
            );
          })}
        </ul>
      )}
      <SampleDataLabel variant="pathways" />
    </section>
  );
}

/** Three topics of a varied society scene, used when the matches share an icon or have not loaded yet. */
const SCENE = ['creative-arts-design', 'control-robotics', 'global-development', 'thermodynamics-energy'] as const;

/**
 * Three different icons on their own gradients (SocietyArt): the top matches' first, then a varied scene, so the
 * banner never shows the same icon twice. Over a soft dot pattern, like the society banners.
 */
function MatchArt({ societies }: { societies: readonly (Society | undefined)[] }) {
  const arts = [...societies.filter((s): s is Society => s !== undefined).map(artFor), ...SCENE.map(artForTopic)]
    .filter((art, i, all) => all.findIndex((a) => a.icon === art.icon) === i)
    .slice(0, 3);
  return (
    <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1.5px)] [background-size:14px_14px]" />
      <div className="absolute -right-6 -bottom-8 size-32 rounded-full bg-white/15 blur-xl" />
      <div className="relative flex items-center gap-3">
        {arts.map((art, i) => (
          <span
            key={art.icon}
            className={cx(
              'grid place-items-center rounded-2xl bg-gradient-to-br text-white shadow-soft ring-1 ring-white/40',
              art.gradient,
              i === 1 ? 'size-16' : 'size-14',
            )}
          >
            <Icon name={art.icon} size={i === 1 ? 30 : 26} />
          </span>
        ))}
      </div>
    </div>
  );
}
