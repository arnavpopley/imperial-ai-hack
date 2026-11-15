import { AnimatePresence, motion } from 'motion/react';
import type { Ref } from 'react';
import { Link } from 'react-router';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { ModuleTypeChip } from '../../components/ModuleTypeChip.tsx';
import { SubScoreBars } from '../../components/SubScoreBars.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { TERM_LABELS } from '../labels.ts';
import { NudgeNote } from '../results/NudgeNote.tsx';
import { useNudge } from '../results/ResultsProvider.tsx';
import { paths } from '../routes.ts';
import type { RankedModule } from '../state/CatalogueProvider.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { DemandChip } from './DemandChip.tsx';
import { ExceptionChip } from './ExceptionChip.tsx';
import { NoScoreRing, ScoreRing } from './ScoreRing.tsx';
import { ShortlistButton } from './ShortlistButton.tsx';

interface ModuleCardProps {
  item: RankedModule;
  /** Low profile confidence greys every score (spec 8.6). */
  lowConfidence: boolean;
  /** False when there is nothing to score yet: no fit number, rank or sub-scores are shown. */
  scored: boolean;
  shortlisted: boolean;
  pending: boolean;
  onToggleShortlist: () => void;
  /** Opens the advisor about an ineligible module. */
  onAsk: (question: string) => void;
  listRef: Ref<HTMLLIElement>;
  /** Position in the list when it first rendered, for the staggered entrance. */
  index: number;
}

/** Cards after this many enter together, so a long list does not trickle in. */
const STAGGER_LIMIT = 8;

export function ModuleCard({ item, lowConfidence, scored, shortlisted, pending, onToggleShortlist, onAsk, listRef, index }: ModuleCardProps) {
  const { module, eligible } = item;
  const title = module?.title ?? item.moduleId;
  const dimmed = lowConfidence || !eligible;
  const { compulsory } = item;
  const { reduce, transition } = useMotionTokens();
  // From the student's own marks, when shared: a gentle note beside the score, never a change to it.
  const nudge = useNudge(item.moduleId);
  // Cohort demand beside the score, never part of it.
  const demand = useReferenceData().demandById.get(item.moduleId);
  const delay = Math.min(index, STAGGER_LIMIT) * 0.05;

  return (
    // The li carries the FLIP reorder transform; the inner card carries the entrance, so the two never fight.
    <li ref={listRef}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition('lessonTransition', delay)}
        className={cx(
          'group relative rounded-card border bg-surface p-5 shadow-soft transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-lift sm:p-6',
          eligible ? 'border-line' : 'border-dashed border-line-strong bg-surface/70',
        )}
      >
        <div className="flex gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-1.5">
            {scored ? (
              <>
                <ScoreRing value={item.fit} dimmed={dimmed} delay={delay + 0.1} />
                <RankShift rank={item.rank} shift={item.rankShift} />
              </>
            ) : (
              <NoScoreRing />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {module && <ModuleTypeChip variant={module.type} />}
                  <ConfidenceBadge variant={item.confidence} />
                  {!eligible && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/6 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                      <Icon name={item.unconfirmed ? 'info' : 'lock'} size={11} />
                      {item.unconfirmed ? "Can't confirm yet" : 'Not eligible yet'}
                    </span>
                  )}
                  {item.exception && <ExceptionChip decision={item.exception} />}
                  {/* Above the stretched card link, so hovering shows where the count comes from. */}
                  {demand && <DemandChip signal={demand} className="relative z-10" />}
                </div>
                <h3 className={cx('mt-1.5 text-[17px] leading-snug font-semibold tracking-tight', !eligible && 'text-muted')}>
                  <Link
                    to={paths.module(item.moduleId)}
                    className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-brand"
                  >
                    {title}
                  </Link>
                </h3>
                {module && (
                  <p className="mt-0.5 text-[13px] text-muted">
                    <span className="font-mono text-[12px]">{module.code}</span> · {module.ects} ECTS ·{' '}
                    {module.terms.map((t) => TERM_LABELS[t]).join(', ')}
                  </p>
                )}
              </div>
              <ShortlistButton
                title={title}
                shortlisted={shortlisted}
                pending={pending}
                onToggle={onToggleShortlist}
                compulsory={compulsory}
                className="relative z-10 max-sm:hidden"
              />
            </div>

            {scored && <SubScoreBars sub={item.sub} variant="compact" dimmed={dimmed} className="mt-4 max-w-lg" />}

            {nudge && <NudgeNote nudge={nudge} className="mt-3 max-w-lg" />}

            {!eligible && item.ineligibleReasons.length > 0 && (
              <div className="relative z-10 mt-3 flex flex-wrap items-start justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                <ul className="min-w-0 flex-1">
                  {item.ineligibleReasons.map((reason) => (
                    <li key={reason} className="flex gap-1.5">
                      <Icon name="info" size={13} className="mt-0.5 shrink-0 text-muted" />
                      {reason}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onAsk(`Can I take ${title} without meeting the requirement?`)}
                  className="font-semibold text-brand underline-offset-2 hover:underline"
                >
                  Ask the advisor
                </button>
              </div>
            )}

            <ShortlistButton
              title={title}
              shortlisted={shortlisted}
              pending={pending}
              onToggle={onToggleShortlist}
              compulsory={compulsory}
              className="relative z-10 mt-4 w-full sm:hidden"
            />
          </div>
        </div>
      </motion.div>
    </li>
  );
}

/**
 * The rank, and how far the current weights moved it. A new shift rises in on the progress-update clock
 * (300ms ease-out) and settles; under reduced motion it only fades.
 */
function RankShift({ rank, shift }: { rank: number; shift: number }) {
  const { softEnter } = useMotionTokens();
  const enter = softEnter('progressUpdate', 4);
  return (
    <span className="relative flex items-center gap-1 text-[12px] font-semibold text-muted tabular-nums">
      #{rank}
      <AnimatePresence mode="popLayout" initial={false}>
        {shift !== 0 && (
          <motion.span
            key={`${rank}-${shift}`}
            {...enter}
            className={cx('inline-flex items-center', shift > 0 ? 'text-fit-high' : 'text-fit-low')}
          >
            <Icon name={shift > 0 ? 'arrow-up' : 'arrow-down'} size={11} />
            {Math.abs(shift)}
            <span className="sr-only">{shift > 0 ? ' places up' : ' places down'} against the default weights</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
