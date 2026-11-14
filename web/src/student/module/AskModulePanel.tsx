// "Ask about this module": a small chat with the module knowledge agent, which answers from this one
// module's record and public description and streams its reply (POST /sessions/:id/modules/:moduleId/ask).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askModule } from '../../api.ts';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { FeedbackControls } from '../../components/FeedbackControls.tsx';
import { GuardrailNotice, type GuardrailVariant } from '../../components/GuardrailNotice.tsx';
import { Icon } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { guardrailVariant } from '../chat/ChatProvider.tsx';

const SUGGESTIONS = ['How is it assessed?', 'What do I need to know beforehand?', 'What will I build or do?'] as const;

interface Notice {
  variant: GuardrailVariant;
  message: string;
  stage: string;
}

interface Turn {
  id: number;
  question: string;
  answer: string;
  status: 'streaming' | 'done' | 'error';
  error: string | null;
  notices: Notice[];
  /** The `done.messageId` of the answer, which answer feedback refers to. */
  messageId: string | null;
}

interface AskModulePanelProps {
  sessionId: string;
  moduleId: string;
  moduleTitle: string;
  className?: string;
}

export function AskModulePanel({ sessionId, moduleId, moduleTitle, className }: AskModulePanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const logRef = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const busy = turns.some((t) => t.status === 'streaming');

  // A new module starts a new conversation; leaving the page stops any reply in flight.
  useEffect(() => {
    setTurns([]);
    return () => abort.current?.abort();
  }, [moduleId]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [turns, reduce]);

  const patch = (id: number, change: (t: Turn) => Turn) =>
    setTurns((current) => current.map((t) => (t.id === id ? change(t) : t)));

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const id = nextId.current++;
    setDraft('');
    setTurns((current) => [...current, { id, question: text, answer: '', status: 'streaming', error: null, notices: [], messageId: null }]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await askModule(
        sessionId,
        moduleId,
        text,
        (event) => {
          if (event.type === 'token') patch(id, (t) => ({ ...t, answer: t.answer + event.text }));
          else if (event.type === 'guardrail' && event.notice) {
            const notice = { variant: guardrailVariant(event.stage, event.verdict), message: event.notice, stage: event.stage };
            patch(id, (t) => ({ ...t, notices: [...t.notices, notice] }));
          } else if (event.type === 'done') patch(id, (t) => ({ ...t, status: 'done', messageId: event.messageId }));
        },
        controller.signal,
      );
      patch(id, (t) => (t.status === 'streaming' ? { ...t, status: 'done' } : t));
    } catch (err) {
      if (controller.signal.aborted) return;
      patch(id, (t) => ({ ...t, status: 'error', error: errorMessage(err) }));
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft);
  };

  const retry = (turn: Turn) => {
    setTurns((current) => current.filter((t) => t.id !== turn.id));
    void ask(turn.question);
  };

  return (
    <section
      aria-labelledby="ask-heading"
      className={cx('flex flex-col rounded-[1.25rem] border border-line bg-surface shadow-soft', className)}
    >
      <div className="flex items-start gap-3 border-b border-line px-5 pt-5 pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand" aria-hidden="true">
          <Icon name="chat" size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="ask-heading" className="text-sm font-semibold">
            Ask about this module
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            Answers come from the module record and public description of {moduleTitle} only.
          </p>
        </div>
      </div>

      <ol
        ref={logRef}
        aria-live="polite"
        aria-label="Questions and answers"
        className="grid max-h-[26rem] min-h-0 content-start gap-3 overflow-y-auto px-5 py-4"
      >
        {turns.length === 0 && (
          <li className="text-[13px] text-muted">Pick a question to start, or write your own.</li>
        )}
        <AnimatePresence initial={false}>
          {turns.map((turn) => (
            <motion.li
              key={turn.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid gap-2"
            >
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-[13px] text-on-brand">
                {turn.question}
              </p>
              {turn.notices.map((n) => (
                <GuardrailNotice key={`${n.stage}-${n.message}`} variant={n.variant} message={n.message} stage={n.stage} />
              ))}
              {(turn.answer || turn.status === 'streaming') && (
                <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line">
                  {turn.answer}
                  {turn.status === 'streaming' && (
                    <span className="animate-caret ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-sm bg-current" aria-hidden="true" />
                  )}
                  {turn.status === 'streaming' && !turn.answer && <span className="text-muted">Reading the module record…</span>}
                </p>
              )}
              {turn.status === 'done' && turn.messageId && turn.answer && (
                <FeedbackControls
                  sessionId={sessionId}
                  target={{ kind: 'module-answer', id: turn.messageId, moduleId }}
                  answer={turn.answer}
                  question={turn.question}
                />
              )}
              {turn.status === 'error' && (
                <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-fit-low/8 px-3 py-2 text-[13px]">
                  <Icon name="info" size={14} className="shrink-0 text-fit-low" />
                  <span className="min-w-0 flex-1">The answer did not come through: {turn.error}</span>
                  <Button size="sm" variant="ghost" icon="reset" onClick={() => retry(turn)} disabled={busy}>
                    Try again
                  </Button>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <div className="grid gap-3 border-t border-line px-5 pt-3 pb-5">
        <ul className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
          {SUGGESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void ask(q)}
                className="rounded-full border border-line-strong px-3 py-1.5 text-[12px] font-medium transition hover:border-brand/50 hover:bg-brand-soft/50 hover:text-brand disabled:opacity-50"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor={`ask-${moduleId}`} className="sr-only">
            Your question about {moduleTitle}
          </label>
          <input
            id={`ask-${moduleId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            placeholder="Ask anything about this module"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 text-sm placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <Button type="submit" variant="primary" icon="send" busy={busy} disabled={!draft.trim()}>
            <span className="max-sm:sr-only">Ask</span>
          </Button>
        </form>
      </div>
    </section>
  );
}
