// One "because" reason as a compact row: a one-line preview that opens to the full text and its source.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { cx } from '../../components/cx.ts';
import type { EvidencePopoverProps } from '../../components/EvidencePopover.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';

const SOURCE_META: Record<EvidencePopoverProps['variant'], { label: string; icon: IconName }> = {
  quote: { label: 'Your words', icon: 'chat' },
  'module-field': { label: 'Module record', icon: 'grid' },
  missing: { label: 'Source', icon: 'info' },
};

interface ReasonRowProps {
  text: string;
  source: EvidencePopoverProps | null;
  /** Watch-outs use the amber tone. */
  tone?: 'reason' | 'watch-out';
}

export function ReasonRow({ text, source, tone = 'reason' }: ReasonRowProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const id = useId();
  const meta = source ? SOURCE_META[source.variant] : null;
  const watchOut = tone === 'watch-out';

  return (
    <li className={cx('rounded-xl border', watchOut ? 'border-fit-mid/30 bg-fit-mid/6' : 'border-line bg-canvas')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${id}-detail` : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left"
      >
        <span
          aria-hidden="true"
          className={cx(
            'grid size-7 shrink-0 place-items-center rounded-full',
            watchOut ? 'bg-fit-mid/15 text-fit-mid' : 'bg-fit-high/12 text-fit-high',
          )}
        >
          <Icon name={watchOut ? 'info' : 'check'} size={14} />
        </span>
        <span className={cx('min-w-0 flex-1 text-sm leading-snug', !open && 'line-clamp-2 sm:line-clamp-1')}>{text}</span>
        {meta && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted sm:inline-flex">
            <Icon name={meta.icon} size={11} />
            {meta.label}
          </span>
        )}
        <Icon
          name="chevron-down"
          size={15}
          className={cx('shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-detail`}
            key="detail"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 pl-[3.25rem] text-xs text-muted">
              <SourceDetail source={source} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function SourceDetail({ source }: { source: EvidencePopoverProps | null }) {
  if (!source) return <p>Drawn from the scoring of your profile against this module.</p>;
  switch (source.variant) {
    case 'quote':
      return (
        <figure className="border-l-2 border-brand/40 pl-3">
          <blockquote className="text-ink italic">“{source.quote}”</blockquote>
          <figcaption className="mt-1 text-2xs">
            You said this in the interview · {source.slotLabel} · {Math.round(source.confidence * 100)}% confidence
          </figcaption>
        </figure>
      );
    case 'module-field':
      return (
        <p>
          <span className="font-medium text-ink">{source.fieldLabel}:</span> {source.value}
        </p>
      );
    case 'missing':
      return <p>The source for this reason is no longer in your profile, for example after an edit.</p>;
  }
}
