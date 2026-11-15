// One clash with its swap suggestions. Spec 10.6: a swap is applied only after the student confirms.
import { SWAP_FIT_TOLERANCE, type Clash, type SwapSuggestion } from '@modulematch/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Button } from '../../components/Button.tsx';
import { ClashMarker } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { FitScore } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { DAY_NAMES, TERM_LABELS } from '../labels.ts';
import { formatRange, toMinutes } from './layout.ts';

interface ClashCardProps {
  clash: Clash;
  /** Swaps that replace either module in this clash. */
  swaps: readonly SwapSuggestion[];
  titleFor: (moduleId: string) => string;
  onSwap: (swap: SwapSuggestion) => Promise<void>;
  onAsk: (question: string) => void;
  /** Spec 12 (PLAN -> ESCALATED): offer a personal tutor note when the clash has no valid swap. */
  onEscalate: (clash: Clash) => void;
}

function overlapText(clash: Clash): string {
  const first = clash.overlaps[0];
  if (!first) return TERM_LABELS[clash.term];
  const start = Math.max(toMinutes(first.a.start), toMinutes(first.b.start));
  const end = Math.min(toMinutes(first.a.end), toMinutes(first.b.end));
  const more = clash.overlaps.length > 1 ? ` and ${clash.overlaps.length - 1} more` : '';
  return `${DAY_NAMES[first.a.day]} ${formatRange(start, end)}${more}, ${TERM_LABELS[clash.term]}`;
}

export function ClashCard({ clash, swaps, titleFor, onSwap, onAsk, onEscalate }: ClashCardProps) {
  const [confirming, setConfirming] = useState<SwapSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const a = titleFor(clash.moduleA);
  const b = titleFor(clash.moduleB);

  const apply = async (swap: SwapSuggestion) => {
    setBusy(true);
    setError(null);
    try {
      await onSwap(swap);
      setConfirming(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    // Clashes slide in when the shortlist creates them and fold away when a swap resolves them.
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 24, transition: { duration: 0.25 } }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx(
        'rounded-card border bg-surface p-4 shadow-soft',
        clash.label === 'certain' ? 'border-clash-certain/40' : 'border-line',
      )}
    >
      <ClashMarker variant={clash.label} probability={clash.probability} />
      <p className="mt-2 text-sm leading-snug">
        <span className="font-semibold">{a}</span> and <span className="font-semibold">{b}</span>{' '}
        {clash.label === 'certain' ? 'overlap' : 'may overlap'}.
      </p>
      <p className="mt-0.5 text-[12px] text-muted">{overlapText(clash)}</p>
      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted">
        <Icon name="clock" size={11} />
        Based on last year's timetable
      </p>

      {swaps.length > 0 ? (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Suggested swaps</p>
          {swaps.map((swap) => {
            const from = titleFor(swap.replaceModuleId);
            const to = titleFor(swap.withModuleId);
            const isConfirming = confirming === swap;
            return (
              <div key={`${swap.replaceModuleId}-${swap.withModuleId}`} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <FitScore value={swap.fit} variant="compact" className="text-sm" />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug">
                    Replace <span className="font-medium">{from}</span> with <span className="font-medium">{to}</span>
                    <span className={cx('ml-1 tabular-nums', swap.fitDelta < 0 ? 'text-muted' : 'text-fit-high')}>
                      ({swap.fitDelta > 0 ? '+' : ''}
                      {swap.fitDelta} fit)
                    </span>
                  </p>
                  {!isConfirming && (
                    <Button size="sm" icon="swap" onClick={() => setConfirming(swap)} disabled={busy}>
                      Swap
                    </Button>
                  )}
                </div>
                {isConfirming && (
                  <div role="group" aria-label="Confirm swap" className="animate-rise mt-3 border-t border-line pt-3">
                    <p className="text-[13px] font-medium">
                      Swap {from} for {to}?
                    </p>
                    <p className="text-[12px] text-muted">Your shortlist changes only when you confirm.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="primary" icon="check" busy={busy} onClick={() => void apply(swap)}>
                        Confirm swap
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[13px]">
          <p>No valid swap: no module of the same kind fits your programme rules and keeps your fit within {SWAP_FIT_TOLERANCE} points.</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() => onAsk(`${a} and ${b} clash and there is no swap. What can I do?`)}
              className="inline-flex items-center gap-1 font-semibold text-brand underline-offset-2 hover:underline"
            >
              <Icon name="chat" size={13} />
              Ask the advisor
            </button>
            <button
              type="button"
              onClick={() => onEscalate(clash)}
              className="inline-flex items-center gap-1 font-semibold text-brand underline-offset-2 hover:underline"
            >
              <Icon name="tutor" size={13} />
              Ask a personal tutor
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-fit-low">
          The swap did not go through: {error}
        </p>
      )}
    </motion.li>
  );
}
