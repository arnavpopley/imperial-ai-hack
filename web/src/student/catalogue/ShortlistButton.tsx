import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { Spinner } from '../../components/Spinner.tsx';

interface ShortlistButtonProps {
  title: string;
  shortlisted: boolean;
  pending: boolean;
  onToggle: () => void;
  /** md on cards, lg on the module page. */
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * A toggle button (aria-pressed) that adds a module to the shortlist or removes it. It reads as a proper
 * secondary button when off and fills with the brand colour when on, with the icon and label swapping in.
 */
export function ShortlistButton({ title, shortlisted, pending, onToggle, size = 'md', className }: ShortlistButtonProps) {
  const reduce = useReducedMotion();
  const swap = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        initial: { opacity: 0, y: 6, scale: 0.8 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -6, scale: 0.8 },
      };
  const iconKey = pending ? 'pending' : shortlisted ? 'on' : 'off';

  return (
    <motion.button
      type="button"
      aria-pressed={shortlisted}
      aria-label={`Shortlist ${title}`}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={onToggle}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 disabled:cursor-wait',
        size === 'md' ? 'h-10 min-w-[8.5rem] px-4 text-sm' : 'h-12 min-w-[10.5rem] px-5 text-[15px]',
        shortlisted
          ? 'bg-brand text-on-brand shadow-soft hover:brightness-110'
          : 'border-2 border-brand/35 bg-surface text-brand hover:border-brand hover:bg-brand-soft/60',
        className,
      )}
    >
      <span className="relative grid size-[18px] place-items-center" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={iconKey} {...swap} transition={{ duration: 0.18 }} className="absolute inset-0 grid place-items-center">
            {pending ? <Spinner size={16} /> : <Icon name={shortlisted ? 'check' : 'plus'} size={18} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span aria-hidden="true">{shortlisted ? 'Shortlisted' : 'Add to shortlist'}</span>
    </motion.button>
  );
}
