// One clash with its swap suggestions. Spec 10.6: a swap is applied only after the student confirms.
import type { Clash, SwapSuggestion } from '@modulematch/shared';
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
}

function overlapText(clash: Clash): string {
  const first = clash.overlaps[0];
  if (!first) return TERM_LABELS[clash.term];
  const start = Math.max(toMinutes(first.a.start), toMinutes(first.b.start));
  const end = Math.min(toMinutes(first.a.end), toMinutes(first.b.end));
  const more = clash.overlaps.length > 1 ? ` and ${clash.overlaps.length - 1} more` : '';
  return `${DAY_NAMES[first.a.day]} ${formatRange(start, end)}${more}, ${TERM_LABELS[clash.term]}`;
}

export function ClashCard({ clash, swaps, titleFor, onSwap, onAsk }: ClashCardProps) {
  const [confirming, setConfirming] = useState<SwapSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
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
    <li
      className={cx(
        'animate-rise rounded-card border bg-surface p-4 shadow-soft',
        clash.label === 'certain' ? 'border-clash-certain/40' : 'border-line',
      )}
    >
      <ClashMarker variant={clash.label} probability={clash.probability} />
      <p className="mt-2 text-sm leading-snug">
        <span className="font-semibold">{a}</span> and <span className="font-semibold">{b}</span>{' '}
        {clash.label === 'certain' ? 'overlap' : 'may overlap'}.
      </p>
      <p className="mt-0.5 text-[12px] text-muted">{overlapText(clash)}</p>

      {swaps.length > 0 ? (
        <div className="mt-3 grid gap-2">
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
          <p>No swap keeps your fit within 10 points.</p>
          <button
            type="button"
            onClick={() => onAsk(`${a} and ${b} clash and there is no swap. What can I do?`)}
            className="mt-1 inline-flex items-center gap-1 font-semibold text-brand underline-offset-2 hover:underline"
          >
            <Icon name="chat" size={13} />
            Ask the advisor
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-fit-low">
          The swap did not go through: {error}
        </p>
      )}
    </li>
  );
}
