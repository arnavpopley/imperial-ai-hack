// Optional step: paste a CV or personal statement. The server redacts it before extracting interests and
// skills, and returns the slots it filled, so the profile panel can light them up.
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { slotLabel } from '../labels.ts';
import { BUSY_MESSAGE, useChat } from '../chat/ChatProvider.tsx';

/** Matches the server's CvBody limit. */
const MAX_LENGTH = 20000;

interface CvResult {
  slots: string[];
  redacted: boolean;
}

interface CvPanelProps {
  /** Called with the slots the CV filled, once the profile has been updated. */
  onImported: (slots: string[]) => void;
  onClose: () => void;
}

/** A 404 means the CV route is not deployed yet; say so plainly instead of showing a status code. */
function cvErrorMessage(err: unknown): string {
  const message = errorMessage(err);
  if (message === BUSY_MESSAGE) return message;
  if (message.startsWith('404')) return 'CV reading is not switched on yet. The conversation covers the same ground.';
  if (message.startsWith('400'))
    return 'That text could not be read. Try pasting plain text of up to 20,000 characters.';
  return 'Something went wrong reading your CV. Please try again in a moment.';
}

export function CvPanel({ onImported, onClose }: CvPanelProps) {
  // Imports go through the chat's send lock, so a CV and a chat answer never save the profile at once.
  const { importCv, sending } = useChat();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvResult | null>(null);
  const inputId = useId();
  const hintId = useId();
  const { softEnter, transition } = useMotionTokens();
  const swap = softEnter('lessonTransition', 10);
  /** A problem reading the CV arrives softly: a short fade and rise, never a shake or a flash. */
  const gentle = softEnter('answerFeedback', 4);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = text.trim();
    if (!content || busy || sending) return;
    setBusy(true);
    setError(null);
    try {
      const response = await importCv(content);
      setResult({ slots: response.slots, redacted: response.redacted });
      setText('');
      onImported(response.slots);
    } catch (err) {
      setError(cvErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${inputId}-heading`} className="grid gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand max-sm:hidden">
          <Icon name="bookmark" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${inputId}-heading`} className="text-xl font-semibold tracking-tight">
            Add your CV
          </h2>
          <p id={hintId} className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Icon name="lock" size={13} className="shrink-0" />
            Grades and personal details are removed before anything is stored.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={16} label="Close CV panel" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div
            key="result"
            {...swap}
            className="grid gap-4 rounded-2xl border border-fit-high/30 bg-fit-high/6 p-5"
            role="status"
          >
            <p className="flex items-center gap-2 font-semibold">
              <span className="grid size-7 place-items-center rounded-full bg-fit-high text-on-brand">
                <Icon name="check" size={14} />
              </span>
              {result.slots.length > 0
                ? `Added ${result.slots.length} thing${result.slots.length === 1 ? '' : 's'} to your profile`
                : 'Read, but nothing new to add'}
            </p>
            {result.slots.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Filled from your CV">
                {result.slots.map((slot, i) => (
                  <motion.li
                    key={slot}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={transition('correctCelebration', 0.08 * i)}
                    className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium shadow-soft ring-1 ring-line"
                  >
                    {slotLabel(slot)}
                  </motion.li>
                ))}
              </ul>
            )}
            {result.redacted && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Icon name="shield" size={14} className="shrink-0 text-brand" />
                Some personal details were removed and not stored.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon="chat" onClick={onClose}>
                Back to the conversation
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Add more
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            {...swap}
            onSubmit={(event) => void submit(event)}
            className="grid gap-3"
          >
            <label htmlFor={inputId} className="text-sm font-medium">
              Paste your CV or personal statement
            </label>
            <textarea
              id={inputId}
              value={text}
              maxLength={MAX_LENGTH}
              aria-describedby={hintId}
              onChange={(event) => setText(event.target.value)}
              placeholder="Projects, societies, placements, the things you have built or led…"
              className="min-h-56 w-full resize-y rounded-2xl border border-line-strong bg-canvas p-4 text-sm leading-relaxed transition outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/12"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-2xs text-muted tabular-nums">
                {sending && !busy
                  ? 'Finishing the current reply…'
                  : `${text.length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`}
              </span>
              <Button type="submit" variant="primary" icon="sparkle" busy={busy} disabled={!text.trim() || sending}>
                Read my CV
              </Button>
            </div>
            {error && (
              <motion.p
                key={error}
                role="alert"
                {...gentle}
                className="flex items-start gap-2 rounded-xl bg-fit-low/8 px-3.5 py-2.5 text-xs text-fit-low"
              >
                <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                {error}
              </motion.p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  );
}
