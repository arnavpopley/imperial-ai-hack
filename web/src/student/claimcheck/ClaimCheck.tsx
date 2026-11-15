// "Check this answer": an optional, closed-by-default checking plan under a piece of AI-written content.
// It never hides or gates the content. Opening it shows one place the content could be wrong, one thing to
// check and where to check it, plus an optional note the student can write for themselves. The note stays in
// this browser (localStorage when a storage key is given) and is never sent to the server.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { buildClaimCheck, type ClaimCheckInput } from './claimCheck.ts';

const STORAGE_PREFIX = 'modulematch.claimcheck.';

interface ClaimCheckProps extends ClaimCheckInput {
  /** The button text, for example "Check this summary". */
  label?: string;
  /** Keeps the student's note across visits in this browser. Without one the note lasts until the page changes. */
  storageKey?: string;
  /** A small icon button until opened, for a list of answers where the full bar would repeat (issue #113). */
  compact?: boolean;
  className?: string;
}

function readNote(key: string | undefined): string {
  if (!key) return '';
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) ?? '';
  } catch {
    return '';
  }
}

function writeNote(key: string | undefined, value: string): void {
  if (!key) return;
  try {
    if (value.trim()) window.localStorage.setItem(STORAGE_PREFIX + key, value);
    else window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Storage can be blocked (private windows); the note then lasts only while the page is open.
  }
}

export function ClaimCheck({ label = 'Check this answer', storageKey, compact = false, className, kind, text, sourceUrl, derivedBy }: ClaimCheckProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(() => readNote(storageKey));
  const reduce = useReducedMotion();
  const id = useId();
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;
  const plan = useMemo(() => buildClaimCheck({ kind, text, sourceUrl, derivedBy }), [kind, text, sourceUrl, derivedBy]);

  // A different piece of content (another module) starts from its own saved note.
  useEffect(() => setNote(readNote(storageKey)), [storageKey]);

  const changeNote = (value: string) => {
    setNote(value);
    writeNote(storageKey, value);
  };

  if (compact && !open) {
    return (
      <button
        id={buttonId}
        type="button"
        aria-expanded={false}
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        className={cx('grid size-7 place-items-center rounded-full border border-dashed border-line-strong text-brand transition-colors hover:bg-surface-2/60', className)}
      >
        <Icon name="search" size={13} />
      </button>
    );
  }

  return (
    <div className={cx('rounded-xl border border-dashed border-line-strong', className)}>
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-muted transition-colors hover:bg-surface-2/60 hover:text-ink"
      >
        <Icon name="search" size={14} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1">{label}</span>
        <span className="hidden shrink-0 text-[11px] font-normal sm:inline">Optional</span>
        <Icon
          name="chevron-down"
          size={14}
          className={cx('shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
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
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 px-3 pt-1 pb-3 text-[13px] leading-relaxed">
              <p className="text-muted">
                AI is often right, and you can’t tell from how sure it sounds. A quick plan for checking it:
              </p>
              <ol className="grid gap-2.5">
                <Step n={1} title="Where it could be wrong">
                  {plan.couldBeWrong}
                </Step>
                <Step n={2} title={`One thing to check: ${plan.check.label.toLowerCase()}`}>
                  {plan.check.how}
                </Step>
                <Step n={3} title="Where to check it">
                  <ul className="grid gap-1">
                    {plan.sources.map((s) => (
                      <li key={s.label}>
                        {s.href ? (
                          <a
                            href={s.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline"
                          >
                            {s.label}
                            <Icon name="external" size={12} />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : (
                          <span className="font-medium text-ink">{s.label}</span>
                        )}
                        <span className="text-muted"> · {s.note}</span>
                      </li>
                    ))}
                  </ul>
                </Step>
              </ol>
              <div className="grid gap-1">
                <label htmlFor={`${id}-note`} className="text-[12px] font-medium">
                  One thing you’ll check (optional)
                </label>
                <input
                  id={`${id}-note`}
                  value={note}
                  onChange={(event) => changeNote(event.target.value)}
                  maxLength={200}
                  placeholder="For example: is the exam really 70%?"
                  aria-describedby={`${id}-note-hint`}
                  className="h-9 min-w-0 rounded-lg border border-line-strong bg-canvas px-3 text-[13px] placeholder:text-muted focus:border-brand focus:outline-none"
                />
                <p id={`${id}-note-hint`} className="text-[11px] text-muted">
                  Kept only in this browser. It is not sent anywhere.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-5 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <div className="text-muted">{children}</div>
      </div>
    </li>
  );
}
