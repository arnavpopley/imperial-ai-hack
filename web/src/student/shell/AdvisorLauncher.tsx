// The "Ask the advisor" chat, as a floating bubble fixed bottom-right with a chat window anchored above it
// (a full-screen sheet on phones). The window is a native modal <dialog>, which traps focus, makes the page
// behind it inert and closes on Escape; motion animates it in and out.
import { AnimatePresence, motion } from 'motion/react';
import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { ModeChip } from '../../components/ModeChip.tsx';
import { ProvenanceLegend } from '../../components/Provenance.tsx';
import { ChatPanel } from '../chat/ChatPanel.tsx';
import { useChat } from '../chat/ChatProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

export interface AdvisorState {
  open: boolean;
  prefill: string;
  /** Bumped on every open, so the panel remounts with the new prefill in its composer. */
  opened: number;
}

interface AdvisorLauncherProps {
  state: AdvisorState;
  onOpen: () => void;
  onClose: () => void;
  /** False on screens that already show the chat (the interview), where only the window may open. */
  showBubble: boolean;
}

/**
 * Changes whenever something arrives that the student has not seen: a finished advisor reply, a drafted
 * escalation, or a staff reply or status change on a sent one.
 */
function useActivitySignature(): string {
  const { session, draft } = useReadySession();
  const { turns } = useChat();
  const replies = turns.filter((t) => t.role !== 'student' && t.status === 'done').length;
  const escalations = session.escalations.map((e) => `${e.id}:${e.status}:${e.staffResponse ? 1 : 0}`).join(',');
  return `${replies}|${draft ? draft.summary : ''}|${escalations}`;
}

/** Past this many pixels of scroll the labelled pill shrinks to its round icon, so it covers less of the page. */
const COLLAPSE_AFTER_PX = 80;
/** The labelled pill's footprint from sm up: 72px tall, about 220px wide, 24px in from the corner. */
const PILL = { width: 224, height: 72, inset: 24 } as const;
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

/** True when a control on the page sits where the labelled pill would be drawn. */
function pillWouldCoverControl(launcher: HTMLElement | null): boolean {
  const right = window.innerWidth - PILL.inset;
  const bottom = window.innerHeight - PILL.inset;
  const left = right - PILL.width;
  const top = bottom - PILL.height;
  for (const el of document.querySelectorAll<HTMLElement>(INTERACTIVE)) {
    if (launcher?.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) return true;
  }
  return false;
}

/**
 * True when a control's centre sits under the icon-only button (72×64px, 16px in from the corner on phones;
 * 72×72px, 24px in from sm up), plus a small margin. On narrow screens content runs under the corner, so even
 * the icon can land on a Swap or remove button as the page scrolls.
 */
function iconWouldCoverControl(launcher: HTMLElement | null): boolean {
  const wide = window.matchMedia('(min-width: 640px)').matches;
  const width = 72;
  const height = wide ? 72 : 64;
  const inset = wide ? 24 : 16;
  const margin = 8;
  const right = document.documentElement.clientWidth - inset + margin;
  const bottom = window.innerHeight - inset + margin;
  const left = right - width - 2 * margin;
  const top = bottom - height - 2 * margin;
  for (const el of document.querySelectorAll<HTMLElement>(INTERACTIVE)) {
    if (launcher?.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x > left && x < right && y > top && y < bottom) return true;
  }
  return false;
}

interface LauncherFit {
  /** Only the round icon: once the page scrolls away from the top, or when the labelled pill would sit over a control. */
  compact: boolean;
  /** Out of the way altogether while a control's centre is under the icon; it comes back as soon as that clears. */
  tucked: boolean;
}

/**
 * How the launcher fits the page under it: the labelled pill at the top of a page, the round icon once the page
 * scrolls or the pill would sit over a control (the module page's question chips, a card's shortlist button),
 * and tucked away while even the icon would cover a control (issue #46).
 */
function useCompactLauncher(launcherRef: RefObject<HTMLElement | null>): LauncherFit {
  const [fit, setFit] = useState<LauncherFit>({ compact: false, tucked: false });
  useEffect(() => {
    let frame = 0;
    let settle = 0;
    const check = () => {
      const compact = window.scrollY > COLLAPSE_AFTER_PX || pillWouldCoverControl(launcherRef.current);
      const tucked = iconWouldCoverControl(launcherRef.current);
      setFit((current) => (current.compact === compact && current.tucked === tucked ? current : { compact, tucked }));
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
      // Entrance animations move controls without a resize or scroll, so check again once they have settled.
      window.clearTimeout(settle);
      settle = window.setTimeout(check, 600);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Content that loads or expands after mount can move a control under the pill without any scroll.
    const resizes = new ResizeObserver(update);
    resizes.observe(document.body);
    const mutations = new MutationObserver(update);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      resizes.disconnect();
      mutations.disconnect();
    };
  }, [launcherRef]);
  return fit;
}

export function AdvisorLauncher({ state, onOpen, onClose, showBubble }: AdvisorLauncherProps) {
  const { session } = useReadySession();
  const signature = useActivitySignature();
  const [seen, setSeen] = useState(signature);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const { open } = state;
  const launcherRef = useRef<HTMLDivElement>(null);
  const { compact: collapsed, tucked } = useCompactLauncher(launcherRef);

  // Seen while the window is open, and on the interview, where the same conversation is already on screen
  // (otherwise the dot lights up on the first screen after the interview with nothing new to read).
  useEffect(() => {
    if (open || !showBubble) setSeen(signature);
  }, [open, showBubble, signature]);
  const unread = !open && signature !== seen;

  // Show the dialog as soon as it opens; it is closed after the exit animation (onExitComplete).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  const finishClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    bubbleRef.current?.focus();
  };

  return (
    <>
      {showBubble && (
        <div
          ref={launcherRef}
          className={cx(
            'fixed right-4 bottom-4 z-(--z-launcher) transition-[opacity,translate] duration-200 sm:right-6 sm:bottom-6',
            // Tucked: hidden and click-through while a control is under it, but shown again to keyboard focus.
            tucked &&
              'pointer-events-none translate-y-4 opacity-0 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100',
          )}
        >
          <AnimatePresence>
            {!open && (
              <motion.button
                ref={bubbleRef}
                type="button"
                onClick={onOpen}
                aria-label={unread ? 'Ask the advisor, new activity' : 'Ask the advisor'}
                aria-haspopup="dialog"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className={cx(
                  'relative flex h-16 items-center gap-3 rounded-full bg-gradient-to-br from-brand to-mode-explain pr-4 pl-4 text-on-brand shadow-lift sm:h-[4.5rem]',
                  collapsed ? 'sm:px-4' : 'sm:pr-7 sm:pl-5',
                )}
              >
                {/* A gentle idle pulse; the reduced-motion rule in index.css stops it after one beat. */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-halo rounded-full bg-brand" />
                <span aria-hidden="true" className="relative grid size-10 place-items-center rounded-full bg-on-brand/15">
                  <Icon name="chat" size={22} />
                  <Icon name="sparkle" size={12} className="absolute top-1 right-1" />
                </span>
                {/*
                 * Labelled on wider screens while the page is at the top, so the advisor is obvious; just the icon on
                 * phones, once the student scrolls, and whenever the pill would sit over a control on the page.
                 * The button's aria-label names it either way.
                 */}
                <span
                  aria-hidden="true"
                  className={cx('relative text-base font-semibold whitespace-nowrap max-sm:hidden', collapsed && 'hidden')}
                >
                  Ask the advisor
                </span>
                {unread && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 size-4 rounded-full bg-fit-low ring-[3px] ring-canvas"
                  />
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        onCancel={(event) => {
          // Escape: let the exit animation run before the dialog closes.
          event.preventDefault();
          onClose();
        }}
        onClick={(event) => {
          // The dialog box is exactly the window, so a click on the dialog itself is on the backdrop.
          if (event.target === event.currentTarget) onClose();
        }}
        className={cx(
          'm-0 overflow-visible bg-transparent p-0 text-ink backdrop:bg-scrim sm:backdrop:bg-transparent',
          'fixed inset-0 h-dvh max-h-none w-full max-w-none',
          'sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(52rem,calc(100dvh-3rem))] sm:w-[min(34rem,calc(100vw-3rem))]',
        )}
      >
        <AnimatePresence onExitComplete={finishClose}>
          {open && (
            <motion.div
              key="advisor-window"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              style={{ transformOrigin: 'bottom right' }}
              className="flex h-full flex-col overflow-hidden bg-surface shadow-lift sm:rounded-panel sm:ring-1 sm:ring-line"
            >
              <header className="flex items-center gap-3 bg-gradient-to-br from-brand to-mode-explain px-5 py-4 text-on-brand">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-on-brand/15 ring-1 ring-on-brand/30">
                  <Icon name="sparkle" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-subheading">
                    Ask the advisor
                  </h2>
                  {/* The chips on each reply and the legend say who did what; the dialog keeps a short description. */}
                  <p id={subtitleId} className="sr-only">
                    Answers in words from the AI. Scores and rules come from code, which the advisor cannot change.
                  </p>
                  <ProvenanceLegend tone="on-brand" className="-ml-1.5" />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-on-brand/90 hover:bg-on-brand/15 hover:text-on-brand"
                >
                  <Icon name="x" size={20} label="Close the advisor" />
                </button>
              </header>
              <div className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-xs text-muted">
                <ModeChip variant={session.mode} />
                <span className="truncate">Your conversation is shared with the interview.</span>
              </div>
              <div className="min-h-0 flex-1">
                <ChatPanel key={state.opened} variant="advisor" prefill={state.prefill} className="h-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </dialog>
    </>
  );
}
