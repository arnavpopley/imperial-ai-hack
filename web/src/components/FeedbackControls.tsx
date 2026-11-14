// Thumbs up or down under one AI answer. A down-vote opens a small panel with reason chips and an optional
// comment. The question and an excerpt of the answer go with the vote so staff can review it; the server
// redacts all three texts before storing them.
import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_EXCERPT_MAX,
  FEEDBACK_QUESTION_MAX,
  type FeedbackRating,
  type FeedbackReason,
  type FeedbackTarget,
} from '@modulematch/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../api.ts';
import { cx } from './cx.ts';
import { errorMessage } from './StateViews.tsx';

const REASONS: readonly { value: FeedbackReason; label: string }[] = [
  { value: 'wrong', label: 'Wrong' },
  { value: 'unhelpful', label: 'Not helpful' },
  { value: 'unclear', label: 'Unclear' },
  { value: 'unsafe', label: 'Unsafe' },
  { value: 'other', label: 'Other' },
];

type Status = 'idle' | 'choosing' | 'sending' | 'sent' | 'error';

interface FeedbackControlsProps {
  sessionId: string;
  target: FeedbackTarget;
  answer: string;
  question?: string;
  className?: string;
}

export function FeedbackControls({ sessionId, target, answer, question, className }: FeedbackControlsProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();
  const commentId = useId();
  const downRef = useRef<HTMLButtonElement>(null);
  const firstChipRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const done = status === 'sent';
  const busy = status === 'sending';

  useEffect(() => {
    if (status !== 'choosing') return;
    // Answers sit in scrolling lists, so bring the whole panel into view before focusing its first chip.
    panelRef.current?.scrollIntoView({ block: 'nearest' });
    firstChipRef.current?.focus({ preventScroll: true });
  }, [status]);

  const send = async (vote: FeedbackRating) => {
    setRating(vote);
    setStatus('sending');
    setError(null);
    try {
      await api.feedback(sessionId, {
        target,
        rating: vote,
        reason: vote === 'down' ? (reason ?? undefined) : undefined,
        comment: vote === 'down' && comment.trim() ? comment.trim() : undefined,
        answerExcerpt: answer.slice(0, FEEDBACK_EXCERPT_MAX) || undefined,
        question: question?.slice(0, FEEDBACK_QUESTION_MAX) || undefined,
      });
      setStatus('sent');
    } catch (err) {
      setError(errorMessage(err));
      setStatus(vote === 'down' ? 'choosing' : 'error');
    }
  };

  const cancel = () => {
    setStatus('idle');
    setRating(null);
    downRef.current?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
    }
  };

  const thumb = (vote: FeedbackRating) => {
    const up = vote === 'up';
    const chosen = rating === vote && (done || busy || status === 'choosing');
    return (
      <button
        ref={up ? undefined : downRef}
        type="button"
        aria-label={up ? 'Helpful answer' : 'Not helpful answer'}
        aria-pressed={chosen}
        aria-expanded={up ? undefined : status === 'choosing'}
        aria-controls={up ? undefined : panelId}
        disabled={done || busy}
        onClick={() => {
          if (up) void send('up');
          else if (status === 'choosing') cancel();
          else {
            setRating('down');
            setError(null);
            setStatus('choosing');
          }
        }}
        className={cx(
          'grid size-8 place-items-center rounded-lg text-[15px] transition disabled:cursor-default',
          chosen ? 'bg-brand-soft ring-1 ring-brand/40' : 'hover:bg-surface-2 disabled:opacity-40',
        )}
      >
        <span aria-hidden="true">{up ? '👍' : '👎'}</span>
      </button>
    );
  };

  return (
    <div className={cx('grid justify-items-start gap-1.5', className)}>
      <div role="group" aria-label="Rate this answer" className="flex items-center gap-0.5">
        {thumb('up')}
        {thumb('down')}
        <p role="status" className="ml-1.5 text-[12px] text-muted">
          {done ? 'Thanks, this helps us improve' : busy ? 'Sending…' : ''}
        </p>
      </div>
      {status === 'error' && error && (
        <p role="alert" className="text-[12px] text-fit-low">
          Feedback did not send: {error}
        </p>
      )}
      {(status === 'choosing' || (busy && rating === 'down')) && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="What was wrong with this answer?"
          onKeyDown={onPanelKeyDown}
          className="grid w-full max-w-sm gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-soft"
        >
          <p className="text-[12px] font-medium">What was wrong?</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r, i) => (
              <button
                key={r.value}
                ref={i === 0 ? firstChipRef : undefined}
                type="button"
                aria-pressed={reason === r.value}
                disabled={busy}
                onClick={() => setReason((current) => (current === r.value ? null : r.value))}
                className={cx(
                  'rounded-full border px-2.5 py-1 text-[12px] font-medium transition',
                  reason === r.value
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-line-strong hover:border-brand/50 hover:text-brand',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label htmlFor={commentId} className="sr-only">
            Comment (optional)
          </label>
          <textarea
            id={commentId}
            rows={2}
            value={comment}
            maxLength={FEEDBACK_COMMENT_MAX}
            disabled={busy}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Anything to add? (optional, no personal details)"
            className="resize-none rounded-lg border border-line-strong bg-canvas px-2.5 py-1.5 text-[12px] placeholder:text-muted focus:border-brand focus:outline-none"
          />
          {error && (
            <p role="alert" className="text-[12px] text-fit-low">
              Feedback did not send: {error}
            </p>
          )}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void send('down')}
              disabled={busy}
              className="rounded-lg bg-brand px-3 py-1 text-[12px] font-medium text-on-brand hover:brightness-110 disabled:opacity-50"
            >
              Send feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
