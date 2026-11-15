// One conversation per session, shared by the interview screen and the "Ask the advisor" drawer.
// Applies each SSE event (spec 13) to the transcript and to the session state.
import type { CvResponse, Evidence, Message, SendMessageBody, SseEvent, Verdict } from '@modulematch/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, sendMessage } from '../../api.ts';
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
  /** The stored message id (from `done.messageId` or the saved transcript), which answer feedback refers to. */
  messageId: string | null;
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
  /**
   * Import a pasted CV (POST /cv). It shares the send lock, because the chat and the CV route both save the
   * whole profile and the later write would erase the other's changes. Rejects with BUSY_MESSAGE while a
   * reply or another import is in flight.
   */
  importCv: (text: string) => Promise<CvResponse>;
  /** Resend the request behind a failed reply, identified by the reply's id. */
  retry: (replyId: string) => void;
  /**
   * "Answer two more" (spec 8.6): returns the session to the interview with a budget of two questions. The server
   * asks the first one straight away; it is appended to the transcript here. Shares the send lock.
   */
  askTwoMore: () => Promise<void>;
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
  return { id: localId(role), role, agent: null, content, status: 'done', notices: [], error: null, messageId: null, ...extra };
}

const STAFF_AGENT = 'staff';

export const BUSY_MESSAGE = 'Wait for the current reply to finish, then try again.';

const fromMessage = (m: Message): ChatTurn => ({ ...turn(m.role, m.content), id: m.id, agent: m.agent, messageId: m.id });

interface SentRequest {
  content: string;
  structured: Structured;
  /** The student turn and the reply it produced, removed before a retry re-adds them. */
  turnIds: readonly string[];
}

/** Render with `key={session.id}` so a new session starts a fresh transcript. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { session, update, replace, offerDraft, invalidateRecs } = useReadySession();
  const sessionId = session.id;
  const [turns, setTurns] = useState<ChatTurn[]>(() => session.messages.map(fromMessage));
  const [sending, setSending] = useState(false);
  const [widget, setWidget] = useState<ChatWidget | null>(null);
  const [recommendationsReady, setRecommendationsReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // The request behind each reply that is still in flight or failed, so a retry resends the right one.
  const requestsRef = useRef(new Map<string, SentRequest>());

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * The stream does not carry interview progress (steps asked, finished), so read it back for the timeline
   * while the send lock is still held. A response older than the session on screen (for example after the
   * student confirmed their profile) is ignored. A failed read keeps the last known progress.
   */
  const refreshProgress = useCallback(
    async (signal: AbortSignal) => {
      try {
        const fresh = await api.getSession(sessionId);
        if (signal.aborted) return;
        update((s) => (fresh.updatedAt >= s.updatedAt ? { ...s, interview: fresh.interview } : s));
      } catch {
        // Transient: the next reply reads progress again.
      }
    },
    [sessionId, update],
  );

  // Staff replies also arrive as assistant messages (agent "staff") through the session poll.
  // The transcript is otherwise local, so append only those, once each.
  const { messages } = session;
  useEffect(() => {
    const staff = messages.filter((m) => m.agent === STAFF_AGENT);
    if (staff.length === 0) return;
    setTurns((list) => {
      const known = new Set(list.map((t) => t.id));
      const fresh = staff.filter((m) => !known.has(m.id));
      return fresh.length > 0 ? [...list, ...fresh.map(fromMessage)] : list;
    });
  }, [messages]);

  const send = useCallback(
    async (content: string, structured?: Structured) => {
      if (abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const student = turn('student', content);
      const reply = turn('assistant', '', { status: 'streaming' });
      requestsRef.current.set(reply.id, { content, structured, turnIds: [student.id, reply.id] });
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
              const added = {
                variant: guardrailVariant(event.stage, event.verdict),
                message: notice,
                stage: event.stage,
              };
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
              update((s) => ({
                ...s,
                escalationDraft: null,
                escalations: upsertEscalation(s.escalations, escalation),
              }));
            }
            break;
          }
          case 'done':
            setWidget(event.widget);
            patchReply((t) => ({ ...t, status: 'done', messageId: event.messageId }));
            break;
        }
      };

      try {
        await sendMessage(sessionId, { content, structured }, onEvent, controller.signal);
        // A stream that closes without `done` still ends the reply.
        patchReply((t) => (t.status === 'streaming' ? { ...t, status: 'done' } : t));
        requestsRef.current.delete(reply.id);
        await refreshProgress(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) patchReply((t) => ({ ...t, status: 'error', error: errorMessage(err) }));
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [sessionId, update, offerDraft, invalidateRecs, refreshProgress],
  );

  const importCv = useCallback(
    async (text: string): Promise<CvResponse> => {
      if (abortRef.current) throw new Error(BUSY_MESSAGE);
      const controller = new AbortController();
      abortRef.current = controller;
      setSending(true);
      try {
        const response = await api.submitCv(sessionId, text);
        if (!controller.signal.aborted) {
          replace(response.session);
          invalidateRecs();
        }
        return response;
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [sessionId, replace, invalidateRecs],
  );

  const retry = useCallback(
    (replyId: string) => {
      const request = requestsRef.current.get(replyId);
      if (!request || abortRef.current) return;
      requestsRef.current.delete(replyId);
      setTurns((list) => list.filter((t) => !request.turnIds.includes(t.id)));
      void send(request.content, request.structured);
    },
    [send],
  );

  const askTwoMore = useCallback(async () => {
    if (abortRef.current) throw new Error(BUSY_MESSAGE);
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    try {
      const fresh = await api.editProfile(sessionId, { resumeInterview: true });
      if (controller.signal.aborted) return;
      replace(fresh);
      invalidateRecs();
      // The server stores the first question as the newest message.
      const question = fresh.messages.at(-1);
      if (question && question.role === 'assistant' && question.agent === 'interviewer') {
        setTurns((list) => (list.some((t) => t.id === question.id) ? list : [...list, fromMessage(question)]));
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [sessionId, replace, invalidateRecs]);

  const value = useMemo(
    () => ({ turns, sending, widget, recommendationsReady, send, importCv, retry, askTwoMore }),
    [turns, sending, widget, recommendationsReady, send, importCv, retry, askTwoMore],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside ChatProvider');
  return value;
}
