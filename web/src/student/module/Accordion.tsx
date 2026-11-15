// A disclosure section: a full-width button with aria-expanded that reveals its panel with a height animation.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';

interface AccordionProps {
  title: ReactNode;
  /** Short text on the right of the header, for example a count. */
  meta?: ReactNode;
  icon?: IconName;
  defaultOpen?: boolean;
  /** Heading level for the header, so the outline stays correct wherever the accordion sits. */
  as?: 'h2' | 'h3' | 'h4';
  /** Flat: no shadow, for an accordion nested inside a card. */
  flat?: boolean;
  className?: string;
  children: ReactNode;
}

export function Accordion({ title, meta, icon, defaultOpen = false, as: Heading = 'h3', flat = false, className, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const id = useId();
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;

  return (
    <div className={cx('rounded-card border border-line', flat ? 'bg-canvas' : 'bg-surface shadow-soft', className)}>
      <Heading className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-card px-4 py-3.5 text-left text-sm font-semibold transition-colors hover:bg-surface-2/60 sm:px-5"
        >
          {icon && (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
              <Icon name={icon} size={15} />
            </span>
          )}
          <span className="min-w-0 flex-1">{title}</span>
          {meta && <span className="shrink-0 text-2xs font-medium text-muted">{meta}</span>}
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.25 }}
            className="grid size-6 shrink-0 place-items-center text-muted"
          >
            <Icon name="chevron-down" size={16} />
          </motion.span>
        </button>
      </Heading>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-1 pb-4 sm:px-5 sm:pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
