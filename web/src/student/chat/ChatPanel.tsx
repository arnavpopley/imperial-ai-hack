// The conversation UI, used by the interview screen and by the "Ask the advisor" drawer.
// Tokens stream into the assistant bubble as they arrive; widgets from `done` render inline.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { GuardrailNotice } from '../../components/GuardrailNotice.tsx';
import { Icon } from '../../components/Icon.tsx';
import { humanise } from '../labels.ts';
import { paths } from '../routes.ts';
import { EscalationTray } from '../shell/EscalationTray.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { useChat, type ChatTurn } from './ChatProvider.tsx';
import { ConfirmProfileCard } from './ConfirmProfileCard.tsx';
import { InlineSliders } from './InlineSliders.tsx';

const MAX_LENGTH = 2000;
const START_MESSAGE = "Hi, I'm ready to start.";

/** Prompts that show off the advisor's roles, including the rule it will not break (demo step 5). */
const ADVISOR_SUGGESTIONS = [
  'Why is my top module ranked first?',
  'What if I cared more about my career?',
  'Can I take a module without its prerequisite?',
] as const;

interface ChatPanelProps {
  /** interview: the main interview. advisor: the drawer on post-interview screens. */
  variant: 'interview' | 'advisor';
  /** Text placed in the composer when the panel opens, for example from an "Ask about this" link. */
  prefill?: string;
  className?: string;
}

export function ChatPanel({ variant, prefill = '', className }: ChatPanelProps) {
  const { session } = useReadySession();
  const { turns, sending, widget, recommendationsReady, send, retry } = useChat();
  const [draft, setDraft] = useState(prefill);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const inputId = useId();

  const lastTurn = turns.at(-1);
  const lastAssistant = turns.findLast((t) => t.role === 'assistant' && t.status === 'done' && t.content);
  const { finished, confirmed } = session.interview;
  // On resume the `done` widget is gone, so fall back to the stored interview state.
  const showConfirm =
    widget?.kind === 'confirm-profile' || (variant === 'interview' && finished && !confirmed && !sending);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [turns, widget, showConfirm, recommendationsReady]);

  useEffect(() => {
    if (variant === 'advisor') inputRef.current?.focus();
  }, [variant]);

  const submit = (text: string, structured?: Record<string, number>) => {
    const content = text.trim();
    if (!content || sending) return;
    stickToBottom.current = true;
    setDraft('');
    void send(content, structured);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
      >
        {turns.length === 0 ? (
          <EmptyConversation variant={variant} onStart={() => submit(START_MESSAGE)} disabled={sending} />
        ) : (
          <ol aria-label="Conversation" className="grid gap-4">
            {turns.map((t) => (
              <TurnView key={t.id} turn={t} onRetry={retry} />
            ))}
          </ol>
        )}

        <div className="mt-4 grid gap-3 empty:hidden">
          {widget?.kind === 'sliders' && lastTurn?.status === 'done' && (
            <InlineSliders fields={widget.fields} disabled={sending} onSubmit={submit} />
          )}
          {widget?.kind === 'choices' && widget.fields.length > 0 && (
            <div role="group" aria-label="Suggested answers" className="flex flex-wrap gap-2">
              {widget.fields.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={sending}
                  onClick={() => submit(choice)}
                  className="rounded-full border border-brand/30 bg-brand-soft px-3.5 py-1.5 text-[13px] font-medium text-brand transition hover:bg-brand hover:text-on-brand"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
          {showConfirm && <ConfirmProfileCard />}
          {variant === 'interview' && recommendationsReady && !showConfirm && (
            <div className="animate-rise flex flex-wrap items-center justify-between gap-3 rounded-card border border-fit-high/30 bg-fit-high/6 px-4 py-3">
              <p className="text-sm font-medium">Your ranked modules are ready.</p>
              <Link to={paths.catalogue} className={buttonClass('primary', 'sm')}>
                See my modules
                <Icon name="arrow-right" size={14} />
              </Link>
            </div>
          )}
          {variant === 'advisor' && <EscalationTray scope="draft" />}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {lastAssistant ? `${humanise(lastAssistant.agent ?? 'advisor')} replied: ${lastAssistant.content}` : ''}
      </p>

      <form onSubmit={onSubmit} className="border-t border-line bg-surface px-3 pt-3 pb-3 sm:px-4">
        {variant === 'advisor' && !sending && (
          <div className="-mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {ADVISOR_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setDraft(s);
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-line px-3 py-1 text-[12px] text-muted transition hover:border-brand/40 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-canvas p-1.5 pl-3.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/12">
          <label htmlFor={inputId} className="sr-only">
            {variant === 'interview' ? 'Your answer' : 'Message the advisor'}
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={variant === 'interview' ? 'Type your answer' : 'Ask about a module, a clash or a rule'}
            className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-snug outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-on-brand transition hover:brightness-110 disabled:opacity-40"
          >
            <Icon name="send" size={16} label="Send" />
          </button>
        </div>
        <p className="mt-1.5 hidden text-[11px] text-muted sm:block">
          Enter to send, Shift and Enter for a new line. Never share grades or health details; they are not stored.
        </p>
      </form>
    </div>
  );
}

function EmptyConversation({
  variant,
  onStart,
  disabled,
}: {
  variant: ChatPanelProps['variant'];
  onStart: () => void;
  disabled: boolean;
}) {
  if (variant === 'advisor') {
    return (
      <div className="grid place-items-center py-10 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="chat" size={20} />
        </span>
        <p className="mt-3 font-semibold">Ask the advisor</p>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Ask why a module fits, what changes if your priorities shift, or how to fix a clash.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-sm place-items-center py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name="sparkle" size={22} />
      </span>
      <p className="mt-4 text-lg font-semibold tracking-tight">A short conversation about you</p>
      <p className="mt-1.5 text-sm text-muted">
        About eight questions on what you enjoy, where you are heading and how you like to learn. Your profile builds
        on the right as you answer.
      </p>
      <button type="button" onClick={onStart} disabled={disabled} className={cx(buttonClass('primary'), 'mt-5')}>
        Start the interview
        <Icon name="arrow-right" size={16} />
      </button>
    </div>
  );
}

function TurnView({ turn, onRetry }: { turn: ChatTurn; onRetry: () => void }) {
  if (turn.role === 'system') {
    return <li className="text-center text-[12px] text-muted">{turn.content}</li>;
  }
  if (turn.role === 'student') {
    return (
      <li className="animate-rise flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-on-brand">
          {turn.content}
        </p>
      </li>
    );
  }

  const streaming = turn.status === 'streaming';
  return (
    <li className="grid max-w-[92%] justify-items-start gap-2" aria-busy={streaming}>
      {turn.notices.map((n, i) => (
        <GuardrailNotice key={`${n.stage}-${i}`} variant={n.variant} message={n.message} stage={n.stage} className="w-full" />
      ))}
      {(turn.content || streaming) && (
        <div className="grid gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
            <Icon name="sparkle" size={11} className="text-brand" />
            {turn.agent ? humanise(turn.agent) : 'Advisor'}
          </span>
          <p className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-soft">
            {turn.content}
            {streaming && (turn.content ? <Caret /> : <TypingDots />)}
          </p>
        </div>
      )}
      {turn.status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-[13px] text-fit-low">
          <Icon name="info" size={14} />
          <span>That message did not go through. {turn.error}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}
    </li>
  );
}

function Caret() {
  return <span aria-hidden="true" className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-caret bg-brand" />;
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1.5" role="status" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse-dot rounded-full bg-muted"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
