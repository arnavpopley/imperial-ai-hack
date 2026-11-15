// A small "i" button that keeps explanatory text out of the way until it is wanted. The note opens on hover, on
// keyboard focus, or with a tap (for touch screens), and closes on Escape, on blur or when the pointer leaves.
// The button names what the note is about; the note is linked to it with aria-describedby while open.
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface InfoTipProps {
  /** Accessible name for the button, for example "About demand against capacity". */
  label: string;
  /** The note itself: plain text or simple inline markup, no links or buttons. */
  children: ReactNode;
  /** Which way the note opens from the button. */
  align?: 'start' | 'end';
  className?: string;
}

export function InfoTip({ label, children, align = 'start', className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={cx('relative inline-flex align-middle', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className={cx(
          'grid size-7 place-items-center rounded-full transition-colors',
          open ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-brand',
        )}
      >
        <Icon name="info" size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <span
            className={cx(
              'absolute top-full z-(--z-popover) pt-2',
              align === 'start' ? 'left-0' : 'right-0',
            )}
          >
            <motion.span
              role="tooltip"
              id={id}
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="block w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-ink px-4 py-3 text-sm leading-relaxed font-normal text-canvas shadow-lift"
            >
              {children}
            </motion.span>
          </span>
        )}
      </AnimatePresence>
    </span>
  );
}
