// Optional step: societies and clubs that match the interests heard so far.
import { motion } from 'motion/react';
import { useEffect, useId } from 'react';
import { api } from '../../api.ts';
import { Icon } from '../../components/Icon.tsx';
import { Meter } from '../../components/Meter.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { Spinner } from '../../components/Spinner.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { useAsync } from '../hooks/useAsync.ts';
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
      <div className="mm-photo relative h-36 overflow-hidden rounded-2xl sm:h-44">
        <img
          src="/images/societies-celebrating.jpg"
          alt="Students celebrating together at a society event"
          className="size-full object-cover"
          loading="lazy"
        />
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
