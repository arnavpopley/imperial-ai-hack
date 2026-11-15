// A slide-over panel built on the native modal <dialog>, which supplies the focus trap,
// Escape to close and an inert page behind it.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  /** Content rendered between the title and the close button. */
  headerExtra?: ReactNode;
  /** md: a 30rem side panel. wide: up to 60rem, for side-by-side content such as a module comparison. */
  size?: 'md' | 'wide';
  /** Pinned below the scrolling content, for the panel's main actions. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, headerExtra, size = 'md', footer, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        'm-0 ml-auto h-dvh max-h-none w-full max-w-none bg-surface text-ink shadow-lift backdrop:bg-scrim open:animate-slide-in sm:border-l sm:border-line',
        size === 'wide' ? 'sm:w-[min(60rem,100vw)]' : 'sm:w-[30rem]',
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
            </div>
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="x" size={18} label="Close" />
            </button>
          </header>
          <div className="min-h-0 flex-1">{children}</div>
          {footer && <footer className="border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
