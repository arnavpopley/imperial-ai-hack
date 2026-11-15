// The optional "Your results" interview step (spec 23): why it helps, an explicit consent tick on every upload,
// a PDF or photo (or pasted text), and the parsed marks as chips. "Skip for now" is always there.
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type DragEvent, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { ACCEPT, checkFile, formatBytes, MAX_FILE_BYTES, readAsBase64, uploadProblem } from './files.ts';
import { MarkSheetIcon, UploadIcon } from './icons.tsx';
import { MarkChips, UnmatchedCodes } from './MarkChips.tsx';
import { wantsAddMarks } from '../routes.ts';
import { useResults, type UploadBody } from './ResultsProvider.tsx';

/** Matches the contract's ResultsUploadBody text limit. */
const MAX_TEXT = 20000;

type InputMode = 'file' | 'text';

interface ResultsPanelProps {
  onClose: () => void;
  onSkip: () => void;
}

const BENEFITS: readonly { icon: IconName; text: string }[] = [
  { icon: 'sparkle', text: "We'll gently flag modules in areas where your marks were lower" },
  { icon: 'shield', text: 'It never changes your scores' },
  { icon: 'lock', text: 'Private to you, delete any time' },
];

export function ResultsPanel({ onClose, onSkip }: ResultsPanelProps) {
  const { hasResults, results } = useResults();
  const [replacing, setReplacing] = useState(false);
  // Adding keeps every mark already shared: an upload only replaces the modules it contains.
  const location = useLocation();
  const [adding, setAdding] = useState(() => wantsAddMarks(location.state));
  const headingId = useId();
  const showSummary = hasResults && !replacing && !adding;

  return (
    <section aria-labelledby={headingId} className="mx-auto grid max-w-2xl gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand max-sm:hidden">
          <MarkSheetIcon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-xl font-semibold tracking-tight">
              Your results
            </h2>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">Optional · recommended</span>
          </div>
          <p className="mt-1 text-[14px] leading-snug text-muted">Share last year's marks for more honest advice. About a minute.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={16} label="Close results panel" />
        </button>
      </div>

      {!showSummary && (
        <ul className="flex flex-wrap gap-2" aria-label="Why it helps">
          {BENEFITS.map((b) => (
            <li key={b.text} className="flex items-start gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] leading-snug">
              <Icon name={b.icon} size={14} className="mt-0.5 shrink-0 text-brand" />
              {b.text}
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {showSummary && results.data ? (
          <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ResultsSummary onReplace={() => setReplacing(true)} onAdd={() => setAdding(true)} onClose={onClose} />
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {adding && hasResults && (
              <p className="mb-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
                Your marks so far stay as they are. Upload a mark sheet with your question marks, for example
                &ldquo;MECH50008 Dynamics 68&rdquo; then &ldquo;Q1 15/20 Q2 14/25&rdquo;; a module you upload again replaces only
                its own marks.
              </p>
            )}
            <UploadForm
              onUploaded={() => {
                setReplacing(false);
                setAdding(false);
              }}
              onSkip={adding && hasResults ? () => setAdding(false) : onSkip}
              skipLabel={adding && hasResults ? 'Cancel' : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function UploadForm({ onUploaded, onSkip, skipLabel = 'Skip for now' }: { onUploaded: () => void; onSkip: () => void; skipLabel?: string }) {
  const { upload } = useResults();
  const [mode, setMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textId = useId();
  const consentId = useId();
  const fileHintId = useId();

  const choose = (picked: File | undefined) => {
    setProblem(null);
    if (!picked) return;
    const check = checkFile(picked);
    if (!check.ok) {
      setFile(null);
      setFileError(check.reason);
      return;
    }
    setFileError(null);
    setFile(picked);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };

  const ready = consent && !busy && (mode === 'file' ? file !== null : text.trim().length > 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setProblem(null);
    let body: UploadBody;
    try {
      if (mode === 'file' && file) {
        const check = checkFile(file);
        if (!check.ok) throw new Error(check.reason);
        body = { consent: true, file: { mediaType: check.mediaType, base64: await readAsBase64(file) } };
      } else {
        body = { consent: true, text: text.trim() };
      }
    } catch {
      setProblem("That file couldn't be opened. Try another one, or paste the text from it.");
      setBusy(false);
      return;
    }
    try {
      await upload(body);
      setConsent(false);
      setFile(null);
      setText('');
      onUploaded();
    } catch (err) {
      const next = uploadProblem(err, body.file !== undefined);
      setProblem(next.message);
      if (next.pasteInstead) setMode('text');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4" aria-busy={busy}>
      <SegmentedControl
        legend="How to share"
        hideLegend
        options={[
          { value: 'file', label: 'Upload a PDF or photo' },
          { value: 'text', label: 'Paste text' },
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setProblem(null);
        }}
      />

      {problem && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-fit-mid/10 px-3.5 py-2.5 text-[13px] leading-snug">
          <Icon name="info" size={14} className="mt-0.5 shrink-0 text-fit-mid" />
          {problem}
        </p>
      )}

      {mode === 'file' ? (
        <div className="grid gap-2">
          {file ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
                <MarkSheetIcon size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{file.name}</p>
                <p className="text-[12px] text-muted">{formatBytes(file.size)}</p>
              </div>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setFile(null)} aria-label={`Remove ${file.name}`}>
                Remove
              </Button>
            </div>
          ) : (
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                'grid cursor-pointer justify-items-center gap-1.5 rounded-2xl border-2 border-dashed px-5 py-6 text-center leading-snug transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/20',
                dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-canvas hover:border-brand/60',
              )}
            >
              <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
                <UploadIcon size={20} />
              </span>
              <span className="text-[15px] font-medium">
                <span className="max-sm:hidden">
                  Drop your transcript here, or <span className="text-brand underline underline-offset-2">choose a file</span>
                </span>
                <span className="text-brand underline underline-offset-2 sm:hidden">Choose a PDF or photo</span>
              </span>
              <span id={fileHintId} className="text-[12.5px] text-muted">
                PDF or photo (PNG or JPEG), up to {formatBytes(MAX_FILE_BYTES)}
              </span>
              <input
                type="file"
                accept={ACCEPT}
                aria-describedby={fileHintId}
                className="sr-only"
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          )}
          {fileError && (
            <p role="alert" className="flex items-start gap-2 text-[13px] text-fit-low">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              {fileError}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-1.5">
          <label htmlFor={textId} className="text-[14px] font-medium">
            Paste your marks, one module per line
          </label>
          <textarea
            id={textId}
            value={text}
            maxLength={MAX_TEXT}
            onChange={(event) => setText(event.target.value)}
            placeholder={'MECH50010 Fluid Mechanics 2 62\nMECH50004 Mechatronics 2 71'}
            className="min-h-36 w-full resize-y rounded-2xl border border-line-strong bg-canvas p-4 font-mono text-[14px] leading-relaxed transition outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/12"
          />
        </div>
      )}

      <p className="flex items-start gap-2 text-[12.5px] leading-snug text-muted">
        <Icon name="sparkle" size={13} className="mt-0.5 shrink-0 text-mode-explain" />
        A mark sheet with marks for each exam question also unlocks tailored exam feedback.
      </p>

      <label
        htmlFor={consentId}
        className={cx(
          'flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3.5 ring-1 transition ring-inset',
          consent ? 'bg-brand-soft ring-brand/40' : 'bg-surface-2 ring-line',
        )}
      >
        <input
          id={consentId}
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-brand"
        />
        <span className="text-[13.5px] leading-snug">
          <span className="font-semibold">I agree to share these marks with ModuleMatch.</span>{' '}
          <span className="text-muted">They are used only for gentle notes and exam feedback for me, and I can withdraw at any time.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onSkip}>
          {skipLabel}
        </Button>
        <Button type="submit" variant="primary" icon="sparkle" busy={busy} disabled={!ready}>
          {busy ? 'Reading your marks' : 'Read my results'}
        </Button>
      </div>
      {!consent && (mode === 'file' ? file !== null : text.trim().length > 0) && (
        <p className="text-right text-[12px] text-muted" aria-live="polite">
          Tick the consent box to continue.
        </p>
      )}
    </form>
  );
}

function ResultsSummary({ onReplace, onAdd, onClose }: { onReplace: () => void; onAdd: () => void; onClose: () => void }) {
  const { results, unmatched, lastSource, withdraw } = useResults();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stored = results.data?.results ?? [];
  const matchedCount = stored.filter((r) => r.matched).length;

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await withdraw();
      onReplace();
    } catch {
      setError('Those marks could not be removed just now. Please try again.');
      setRemoving(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-fit-high/30 bg-fit-high/6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-fit-high text-on-brand" aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
          {matchedCount === 0
            ? 'None of these codes are in our catalogue'
            : `${lastSource ? 'Read' : 'Shared'} ${matchedCount === 1 ? '1 module' : `${matchedCount} modules`}`}
        </p>
        {lastSource && (
          <span className="text-[11.5px] text-muted">{lastSource === 'model' ? 'Read by AI' : 'Read by the offline parser'}</span>
        )}
      </div>
      <MarkChips results={stored} />
      <UnmatchedCodes codes={unmatched} />

      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div
            key="confirm"
            role="group"
            aria-label="Remove these marks"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 rounded-xl bg-surface p-3.5 ring-1 ring-line"
          >
            <p className="text-[13.5px]">Remove these marks so you can upload again? Nothing is kept.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon="trash" busy={removing} onClick={() => void remove()}>
                Remove and re-upload
              </Button>
              <Button size="sm" variant="ghost" disabled={removing} onClick={() => setConfirming(false)}>
                Keep them
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-fit-low">
                {error}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon="chat" onClick={onClose}>
              Back to the conversation
            </Button>
            <Button variant="secondary" icon="plus" onClick={onAdd}>
              Add more marks
            </Button>
            <Button variant="ghost" icon="edit" onClick={() => setConfirming(true)}>
              Looks wrong? Edit or remove
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
