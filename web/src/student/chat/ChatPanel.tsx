// The conversation UI, used by the interview screen and by the "Ask the advisor" drawer.
// Tokens stream into the assistant bubble beside the chosen interviewer's face, which nods while it
// "speaks"; widgets from `done` slide in below. The interviewer's latest question is shown larger.
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { FeedbackControls } from '../../components/FeedbackControls.tsx';
import { GuardrailNotice } from '../../components/GuardrailNotice.tsx';
import { Icon } from '../../components/Icon.tsx';
import { InterviewerAvatar } from '../interview/InterviewerAvatar.tsx';
import { InterviewerStage } from '../interview/InterviewerStage.tsx';
import { useInterviewer, type Persona } from '../interview/personas.ts';
import { humanise } from '../labels.ts';
import { paths } from '../routes.ts';
import { EscalationTray } from '../shell/EscalationTray.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { useChat, type ChatTurn } from './ChatProvider.tsx';
import { ConfirmProfileCard } from './ConfirmProfileCard.tsx';
import { InlineSliders } from './InlineSliders.tsx';

const MAX_LENGTH = 2000;
const START_MESSAGE = "Hi, I'm ready to start.";
const STAFF_AGENT = 'staff';

/** Prompts that show off the advisor's roles, including the rule it will not break (demo step 5). */
const ADVISOR_SUGGESTIONS = [
  'Why is my top module ranked first?',
  'What if I cared more about my career?',
  'Can I take a module without its prerequisite?',
] as const;

const EASE = [0.2, 0.8, 0.2, 1] as const;
const ENTER = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.4, ease: EASE },
};

interface ChatPanelProps {
  /** interview: the main interview. advisor: the drawer on post-interview screens. */
  variant: 'interview' | 'advisor';
  /** Text placed in the composer when the panel opens, for example from an "Ask about this" link. */
  prefill?: string;
  className?: string;
  /** Interview only: offers "paste your CV instead" on the empty conversation. */
  onAddCv?: () => void;
}

export function ChatPanel({ variant, prefill = '', className, onAddCv }: ChatPanelProps) {
  const { session } = useReadySession();
  const { turns, sending, widget, recommendationsReady, send, retry } = useChat();
  const persona = useInterviewer();
  const [draft, setDraft] = useState(prefill);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const inputId = useId();
  const interview = variant === 'interview';

  const lastTurn = turns.at(-1);
  const speaking = turns.some((t) => t.role === 'assistant' && t.status === 'streaming');
  const lastAssistant = turns.findLast((t) => t.role === 'assistant' && t.status === 'done' && t.content);
  // The interviewer's latest message is the question on screen, so it is set larger than the history.
  const latestAssistantId = turns.findLast((t) => t.role === 'assistant')?.id;
  const { finished, confirmed } = session.interview;
  // On resume the `done` widget is gone, so fall back to the stored interview state. Once the
  // profile is confirmed the card stays hidden, even if the last widget asked for it.
  const showConfirm = !confirmed && (widget?.kind === 'confirm-profile' || (interview && finished && !sending));

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
    <MotionConfig reducedMotion="user">
      <div className={cx('flex min-h-0 flex-col', className)}>
        {/* Face to face: once the interview is under way, the interviewer stays in view above the conversation. */}
        {interview && turns.length > 0 && (
          <InterviewerStage persona={persona} speaking={speaking} layout="strip" className="shrink-0 border-b border-line" />
        )}
        <div
          ref={scrollRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className={cx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            interview ? 'px-4 py-6 sm:px-8 sm:py-8' : 'px-4 py-5 sm:px-5',
          )}
        >
          {turns.length === 0 ? (
            <EmptyConversation
              variant={variant}
              persona={persona}
              onStart={() => submit(START_MESSAGE)}
              onAddCv={onAddCv}
              disabled={sending}
            />
          ) : (
            <ol aria-label="Conversation" className={cx('grid', interview ? 'gap-7' : 'gap-5')}>
              <AnimatePresence initial={false}>
                {turns.map((t, i) => (
                  <TurnView
                    key={t.id}
                    turn={t}
                    persona={persona}
                    prominent={interview && t.id === latestAssistantId}
                    onRetry={() => retry(t.id)}
                    sessionId={session.id}
                    question={turns.slice(0, i).findLast((p) => p.role === 'student')?.content}
                  />
                ))}
              </AnimatePresence>
            </ol>
          )}

          <div className="mt-6 grid gap-3 empty:hidden">
            <AnimatePresence>
              {widget?.kind === 'sliders' && lastTurn?.status === 'done' && (
                <motion.div key="sliders" {...ENTER}>
                  <InlineSliders fields={widget.fields} disabled={sending} onSubmit={submit} />
                </motion.div>
              )}
              {widget?.kind === 'choices' && widget.fields.length > 0 && (
                <motion.div
                  key="choices"
                  {...ENTER}
                  role="group"
                  aria-label="Suggested answers"
                  className={cx('flex flex-wrap gap-2.5', interview && 'sm:pl-14')}
                >
                  {widget.fields.map((choice, i) => (
                    <motion.button
                      key={choice}
                      type="button"
                      disabled={sending}
                      onClick={() => submit(choice)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 * i }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      className="rounded-full border border-brand/30 bg-brand-soft px-4 py-2 text-[14px] font-medium text-brand transition-colors hover:bg-brand hover:text-on-brand"
                    >
                      {choice}
                    </motion.button>
                  ))}
                </motion.div>
              )}
              {showConfirm && (
                <motion.div key="confirm" {...ENTER}>
                  <ConfirmProfileCard />
                </motion.div>
              )}
              {interview && recommendationsReady && !showConfirm && (
                <motion.div
                  key="ready"
                  {...ENTER}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fit-high/30 bg-fit-high/6 px-5 py-4"
                >
                  <p className="font-medium">Your ranked modules are ready.</p>
                  <Link to={paths.catalogue} className={buttonClass('primary')}>
                    See my modules
                    <Icon name="arrow-right" size={14} />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            {variant === 'advisor' && <EscalationTray scope="draft" />}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {lastAssistant ? `${speakerName(lastAssistant.agent, persona)} replied: ${lastAssistant.content}` : ''}
        </p>

        <form
          onSubmit={onSubmit}
          className={cx('border-t border-line bg-surface', interview ? 'px-4 py-4 sm:px-8' : 'px-3 py-3 sm:px-4')}
        >
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
          <div className="flex items-end gap-2 rounded-[1.25rem] border border-line-strong bg-canvas p-2 pl-4 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/12">
            <label htmlFor={inputId} className="sr-only">
              {interview ? 'Your answer' : 'Message the advisor'}
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={interview ? 'Type your answer' : 'Ask about a module, a clash or a rule'}
              className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-snug outline-none placeholder:text-muted focus-visible:outline-none"
            />
            <motion.button
              type="submit"
              disabled={sending || !draft.trim()}
              whileTap={{ scale: 0.92 }}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-on-brand transition hover:brightness-110 disabled:opacity-40"
            >
              <Icon name="send" size={16} label="Send" />
            </motion.button>
          </div>
          <p className="mt-2 hidden text-[12px] text-muted sm:block">
            Enter to send. Grades and health details are never stored.
          </p>
        </form>
      </div>
    </MotionConfig>
  );
}

/** Advisor turns speak as the chosen persona; staff replies come from a person. */
function speakerName(agent: string | null, persona: Persona): string {
  return agent === STAFF_AGENT ? 'Staff' : persona.name;
}

function EmptyConversation({
  variant,
  persona,
  onStart,
  onAddCv,
  disabled,
}: {
  variant: ChatPanelProps['variant'];
  persona: Persona;
  onStart: () => void;
  onAddCv?: () => void;
  disabled: boolean;
}) {
  if (variant === 'advisor') {
    return (
      <div className="grid place-items-center py-10 text-center">
        <InterviewerAvatar persona={persona} size={56} />
        <p className="mt-3 font-semibold">Ask {persona.name}</p>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Why a module fits, what changes if your priorities shift, or how to fix a clash.
        </p>
      </div>
    );
  }
  return (
    <motion.div {...ENTER} className="mx-auto grid max-w-md justify-items-center py-6 text-center sm:py-10">
      <InterviewerStage persona={persona} speaking={false} layout="hero" />
      <p className="mt-8 text-2xl font-semibold tracking-tight">Hi, I&rsquo;m {persona.name}.</p>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        A few easy questions about what you enjoy. No right answers.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          className={cx(buttonClass('primary'), 'h-11 px-5 text-[15px]')}
        >
          Let&rsquo;s start
          <Icon name="arrow-right" size={16} />
        </button>
        {onAddCv && (
          <button type="button" onClick={onAddCv} className={cx(buttonClass('secondary'), 'h-11 px-5 text-[15px]')}>
            <Icon name="bookmark" size={15} />
            Start from my CV
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** Interview questions and staff replies are not AI answers, so they get no feedback controls. */
const UNRATED_AGENTS = new Set([STAFF_AGENT, 'interviewer']);

function TurnView({
  turn,
  persona,
  prominent,
  onRetry,
  sessionId,
  question,
}: {
  turn: ChatTurn;
  persona: Persona;
  prominent: boolean;
  onRetry: () => void;
  sessionId: string;
  /** The student turn this reply answers, sent with feedback for review. */
  question?: string;
}) {
  if (turn.role === 'system') {
    return (
      <motion.li layout="position" {...ENTER} className="text-center text-[13px] text-muted">
        {turn.content}
      </motion.li>
    );
  }
  if (turn.role === 'student') {
    return (
      <motion.li layout="position" {...ENTER} className="flex justify-end">
        <p className="max-w-[85%] rounded-[1.25rem] rounded-br-md bg-brand px-5 py-3 text-base leading-relaxed whitespace-pre-wrap text-on-brand shadow-soft">
          {turn.content}
        </p>
      </motion.li>
    );
  }

  const streaming = turn.status === 'streaming';
  const staff = turn.agent === STAFF_AGENT;
  return (
    <motion.li
      layout="position"
      {...ENTER}
      className="flex max-w-[94%] items-start gap-3 sm:gap-4"
      aria-busy={streaming}
    >
      {staff ? (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-mode-plan/15 text-mode-plan"
          aria-hidden="true"
        >
          <Icon name="user" size={18} />
        </span>
      ) : (
        <InterviewerAvatar persona={persona} speaking={streaming} size={40} />
      )}
      <div className="grid min-w-0 flex-1 justify-items-start gap-2">
        <span className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold">{speakerName(turn.agent, persona)}</span>
          {turn.agent && !staff && turn.agent !== 'interviewer' && (
            <span className="text-muted">{humanise(turn.agent)}</span>
          )}
        </span>
        {turn.notices.map((n, i) => (
          <GuardrailNotice
            key={`${n.stage}-${i}`}
            variant={n.variant}
            message={n.message}
            stage={n.stage}
            className="w-full"
          />
        ))}
        {(turn.content || streaming) && (
          <p
            className={cx(
              'rounded-[1.25rem] rounded-tl-md border border-line bg-surface whitespace-pre-wrap shadow-soft',
              prominent
                ? 'px-5 py-4 text-[1.2rem] leading-snug font-medium tracking-tight sm:text-[1.35rem]'
                : 'px-5 py-3 text-base leading-relaxed',
            )}
          >
            {turn.content}
            {streaming && (turn.content ? <Caret /> : <TypingDots />)}
          </p>
        )}
        {turn.status === 'done' && turn.messageId && turn.content && !UNRATED_AGENTS.has(turn.agent ?? '') && (
          <FeedbackControls
            sessionId={sessionId}
            target={{ kind: 'message', id: turn.messageId }}
            answer={turn.content}
            question={question}
          />
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
      </div>
    </motion.li>
  );
}

function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-caret bg-brand"
    />
  );
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
