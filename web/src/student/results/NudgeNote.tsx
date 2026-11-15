// A gentle "Keep in mind" note from the student's own marks (spec 23). Teal and calm, so it never reads as
// an eligibility gate (grey, lock) or an error (red); the fit score beside it is unchanged.
import type { PerformanceNudge } from '@modulematch/shared';
import { useId, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { topicLabel } from '../labels.ts';
import { yourDataPath } from '../yourdata/paths.ts';
import { BulbIcon } from './icons.tsx';

export const NUDGE_EXPLAINER = 'Based on your own marks. Your fit score is unchanged.';

/** A small info button with a tooltip that opens on hover, focus or tap, and closes on Escape. */
export function InfoTip({ text, label, className }: { text: string; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };
  return (
    <span className={cx('relative inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={tipId}
        // Opens only: a tap focuses and clicks, and a toggle here would close what focus just opened.
        // Escape, moving away or tapping elsewhere closes it.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="grid size-7 place-items-center rounded-full text-mode-plan transition hover:bg-mode-plan/12"
      >
        <Icon name="info" size={15} />
      </button>
      <span
        role="tooltip"
        id={tipId}
        className={cx(
          'absolute top-full right-0 z-(--z-popover) mt-1.5 w-56 rounded-xl bg-ink px-3 py-2 text-[12.5px] leading-snug text-canvas shadow-lift transition duration-150',
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
        )}
      >
        {text}
      </span>
    </span>
  );
}

interface NudgeNoteProps {
  nudge: PerformanceNudge;
  /** "card" is one quiet line on a catalogue card; "page" adds the topics and the explanation on the module page. */
  variant?: 'card' | 'page';
  className?: string;
}

export function NudgeNote({ nudge, variant = 'card', className }: NudgeNoteProps) {
  if (variant === 'card') {
    return (
      <div
        className={cx(
          'relative z-10 flex items-start gap-2.5 rounded-xl bg-mode-plan/8 py-2 pr-1.5 pl-3 text-[13px] ring-1 ring-mode-plan/20 ring-inset',
          className,
        )}
      >
        <BulbIcon size={15} className="mt-0.5 shrink-0 text-mode-plan" />
        <p className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold text-mode-plan">Keep in mind </span>
          <span className="text-ink/85">{nudge.message}</span>
        </p>
        <InfoTip text={NUDGE_EXPLAINER} label="About this note" className="-my-1" />
      </div>
    );
  }
  return (
    <section
      aria-label="Keep in mind"
      className={cx('relative flex gap-3.5 rounded-2xl bg-mode-plan/8 p-4 ring-1 ring-mode-plan/20 ring-inset sm:p-5', className)}
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-mode-plan/15 text-mode-plan">
        <BulbIcon size={18} />
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-mode-plan uppercase">Keep in mind</p>
        <p className="text-[15px] leading-relaxed text-pretty">{nudge.message}</p>
        {nudge.topics.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
            {nudge.topics.map((topic) => (
              <li key={topic} className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-medium text-mode-plan ring-1 ring-mode-plan/25">
                {topicLabel(topic)}
              </li>
            ))}
          </ul>
        )}
        <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
          <Icon name="lock" size={12} className="shrink-0" />
          {NUDGE_EXPLAINER}
          <Link to={yourDataPath} className="font-medium text-mode-plan underline-offset-2 hover:underline">
            See your marks
          </Link>
        </p>
      </div>
    </section>
  );
}
