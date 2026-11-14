// One conversation per session, shared by the interview screen and the "Ask the advisor" drawer.
// Applies each SSE event (spec 13) to the transcript and to the session state.
import type { Evidence, SendMessageBody, SseEvent, Verdict } from '@modulematch/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sendMessage } from '../../api.ts';
import type { GuardrailVariant } from '../../components/GuardrailNotice.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { upsertEscalation } from '../hooks/useEscalationDraft.ts';
import { useReadySession } from '../state/SessionProvider.tsx';

export interface ChatNotice {
  variant: GuardrailVariant;
  message: string;
  stage: string;
}

export interface ChatTurn {
  id: string;
  role: 'student' | 'assistant' | 'system';
  /** The agent that wrote an assistant turn, for example "interviewer" or "matcher". */
  agent: string | null;
  content: string;
  status: 'streaming' | 'done' | 'error';
  /** Guardrail notices raised while this reply was produced. */
  notices: ChatNotice[];
  error: string | null;
}

export type ChatWidget = NonNullable<Extract<SseEvent, { type: 'done' }>['widget']>;
type Structured = SendMessageBody['structured'];

interface ChatContextValue {
  turns: ChatTurn[];
  sending: boolean;
  /** The UI hint from the last `done` event, cleared when the student sends again. */
  widget: ChatWidget | null;
  /** Set once the stream reports that ranked recommendations are ready. */
  recommendationsReady: boolean;
  send: (content: string, structured?: Structured) => Promise<void>;
  retry: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Maps a guardrail event to a notice variant. The event carries the stage name and verdict only,
 * so this matches the stage names from spec 11 (G1 scope, G2 redaction, G4 wellbeing).
 */
export function guardrailVariant(stage: string, verdict: Verdict): GuardrailVariant {
  const name = stage.toLowerCase();
  if (name.includes('g4') || name.includes('wellbeing')) return 'wellbeing';
  if (verdict === 'redact' || name.includes('g2') || name.includes('redact')) return 'redacted';
  if (name.includes('g1') || name.includes('scope')) return 'out-of-scope';
  return 'blocked';
}

/** profile_update may carry the full evidence list or only new items; merging by id handles both. */
function mergeEvidence(current: readonly Evidence[], incoming: readonly Evidence[]): Evidence[] {
  const byId = new Map(current.map((e) => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()];
}

let localCounter = 0;
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(localCounter += 1)}`;

function turn(role: ChatTurn['role'], content: string, extra: Partial<ChatTurn> = {}): ChatTurn {
  return { id: localId(role), role, agent: null, content, status: 'done', notices: [], error: null, ...extra };
}

interface LastSend {
  content: string;
  structured: Structured;
  turnIds: readonly string[];
}

/** Render with `key={session.id}` so a new session starts a fresh transcript. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { session, update, offerDraft, invalidateRecs } = useReadySession();
  const sessionId = session.id;
  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    session.messages.map((m) => ({ ...turn(m.role, m.content), id: m.id, agent: m.agent })),
  );
  const [sending, setSending] = useState(false);
  const [widget, setWidget] = useState<ChatWidget | null>(null);
  const [recommendationsReady, setRecommendationsReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastSendRef = useRef<LastSend | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (content: string, structured?: Structured) => {
      if (abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const student = turn('student', content);
      const reply = turn('assistant', '', { status: 'streaming' });
      lastSendRef.current = { content, structured, turnIds: [student.id, reply.id] };
      setTurns((list) => [...list, student, reply]);
      setWidget(null);
      setSending(true);

      const patchReply = (patch: (t: ChatTurn) => ChatTurn) =>
        setTurns((list) => list.map((t) => (t.id === reply.id ? patch(t) : t)));

      const onEvent = (event: SseEvent) => {
        switch (event.type) {
          case 'mode':
            update((s) => ({ ...s, mode: event.mode }));
            break;
          case 'token':
            patchReply((t) => ({ ...t, content: t.content + event.text, agent: event.agent }));
            break;
          case 'profile_update':
            update((s) => ({ ...s, profile: event.profile, evidence: mergeEvidence(s.evidence, event.evidence) }));
            break;
          case 'guardrail': {
            const { notice } = event;
            if (notice) {
              const added = { variant: guardrailVariant(event.stage, event.verdict), message: notice, stage: event.stage };
              patchReply((t) => ({ ...t, notices: [...t.notices, added] }));
            }
            break;
          }
          case 'recommendations_ready':
            setRecommendationsReady(true);
            invalidateRecs();
            break;
          case 'escalation': {
            const { escalation } = event;
            if (event.draft) offerDraft(event.draft);
            if (escalation) {
              offerDraft(null);
              update((s) => ({ ...s, escalationDraft: null, escalations: upsertEscalation(s.escalations, escalation) }));
            }
            break;
          }
          case 'done':
            setWidget(event.widget);
            patchReply((t) => ({ ...t, status: 'done' }));
            break;
        }
      };

      try {
        await sendMessage(sessionId, { content, structured }, onEvent, controller.signal);
        // A stream that closes without `done` still ends the reply.
        patchReply((t) => (t.status === 'streaming' ? { ...t, status: 'done' } : t));
      } catch (err) {
        if (!controller.signal.aborted) patchReply((t) => ({ ...t, status: 'error', error: errorMessage(err) }));
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [sessionId, update, offerDraft, invalidateRecs],
  );

  const retry = useCallback(() => {
    const last = lastSendRef.current;
    if (!last || abortRef.current) return;
    setTurns((list) => list.filter((t) => !last.turnIds.includes(t.id)));
    void send(last.content, last.structured);
  }, [send]);

  const value = useMemo(
    () => ({ turns, sending, widget, recommendationsReady, send, retry }),
    [turns, sending, widget, recommendationsReady, send, retry],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside ChatProvider');
  return value;
}
