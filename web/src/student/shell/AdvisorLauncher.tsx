// The "Ask the advisor" chat, as a floating bubble fixed bottom-right with a chat window anchored above it
// (a full-screen sheet on phones). The window is a native modal <dialog>, which traps focus, makes the page
// behind it inert and closes on Escape; motion animates it in and out.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { ModeChip } from '../../components/ModeChip.tsx';
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

export function AdvisorLauncher({ state, onOpen, onClose, showBubble }: AdvisorLauncherProps) {
  const { session } = useReadySession();
  const signature = useActivitySignature();
  const [seen, setSeen] = useState(signature);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const { open } = state;

  // Anything that happens while the window is open counts as seen.
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
        <div className="fixed right-4 bottom-4 z-(--z-launcher) sm:right-6 sm:bottom-6">
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
                className="relative flex h-16 items-center gap-3 rounded-full bg-gradient-to-br from-brand to-mode-explain pr-4 pl-4 text-on-brand shadow-lift sm:h-[4.5rem] sm:pr-7 sm:pl-5"
              >
                {/* A gentle idle pulse; the reduced-motion rule in index.css stops it after one beat. */}
                <span aria-hidden="true" className="absolute inset-0 animate-halo rounded-full bg-brand" />
                <span aria-hidden="true" className="relative grid size-10 place-items-center rounded-full bg-on-brand/15">
                  <Icon name="chat" size={22} />
                  <Icon name="sparkle" size={12} className="absolute top-1 right-1" />
                </span>
                {/* Always labelled on wider screens so the advisor is obvious; just the icon on phones. */}
                <span aria-hidden="true" className="relative text-base font-semibold whitespace-nowrap max-sm:hidden">
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
                  <h2 id={titleId} className="text-base font-semibold tracking-tight">
                    Ask the advisor
                  </h2>
                  <p id={subtitleId} className="text-xs text-on-brand/85">
                    Explains scores and checks the rules. It never changes a number.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-on-brand/90 hover:bg-on-brand/15 hover:text-on-brand"
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
