// Typed client for the API contract in spec section 13. Screens call these instead of fetch directly.
import { schemas } from '@modulematch/shared';
import type {
  ClashPriority,
  CreateEscalationBody,
  DerivedEditBody,
  Escalation,
  EvalRun,
  ExplanationResponse,
  Insight,
  InsightDecisionBody,
  Module,
  ModuleSummary,
  CvResponse,
  Pathway,
  PathwayProgress,
  ProfileEditBody,
  RecommendationsResponse,
  SessionState,
  SendMessageBody,
  ShortlistBody,
  Society,
  SocietyMatch,
  SseEvent,
  StaffEscalation,
  StaffModuleSummary,
  TimetableView,
  TraceEvent,
  Weights,
} from '@modulematch/shared';
import type { z } from 'zod';

type CreateSessionInput = z.input<typeof schemas.CreateSessionBody>;
type RespondInput = z.input<typeof schemas.EscalationRespondBody>;

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const s = (id: string) => `/sessions/${encodeURIComponent(id)}`;

export const api = {
  createSession: (body: CreateSessionInput) => call<SessionState>('/sessions', { body }),
  getSession: (id: string) => call<SessionState>(s(id)),
  editProfile: (id: string, body: ProfileEditBody) => call<SessionState>(`${s(id)}/profile`, { method: 'PUT', body }),
  deleteProfile: (id: string) => call<SessionState>(`${s(id)}/profile`, { method: 'DELETE' }),
  setWeights: (id: string, body: Weights) =>
    call<RecommendationsResponse>(`${s(id)}/weights`, { method: 'PUT', body }),
  recommendations: (id: string) => call<RecommendationsResponse>(`${s(id)}/recommendations`),
  explanation: (id: string, moduleId: string) =>
    call<ExplanationResponse>(`${s(id)}/modules/${encodeURIComponent(moduleId)}/explanation`),
  shortlist: (id: string, body: ShortlistBody) => call<SessionState>(`${s(id)}/shortlist`, { body }),
  timetable: (id: string) => call<TimetableView>(`${s(id)}/timetable`),
  escalate: (id: string, body: CreateEscalationBody) => call<Escalation>(`${s(id)}/escalations`, { body }),
  pathwayProgress: (id: string, pathwayId: string) =>
    call<PathwayProgress>(`${s(id)}/pathways/${encodeURIComponent(pathwayId)}/progress`),
  societyMatches: (id: string) => call<SocietyMatch[]>(`${s(id)}/societies`),
  /** Pasted CV or personal statement: redacted on the server, then mined for interests and skills. */
  submitCv: (id: string, text: string) => call<CvResponse>(`${s(id)}/cv`, { body: { text } }),

  staff: {
    modules: () => call<StaffModuleSummary[]>('/staff/modules'),
    insights: (moduleId: string) => call<Insight[]>(`/staff/modules/${encodeURIComponent(moduleId)}/insights`),
    decide: (insightId: string, body: InsightDecisionBody) =>
      call<Insight>(`/staff/insights/${encodeURIComponent(insightId)}/decision`, { body }),
    editDerived: (moduleId: string, body: DerivedEditBody) =>
      call<Module>(`/staff/modules/${encodeURIComponent(moduleId)}/derived`, { method: 'PUT', body }),
    clashPriorities: () => call<ClashPriority[]>('/staff/timetable/clash-priorities'),
    escalations: () => call<StaffEscalation[]>('/staff/escalations'),
    respond: (escalationId: string, body: RespondInput) =>
      call<Escalation>(`/staff/escalations/${encodeURIComponent(escalationId)}/respond`, { body }),
  },

  modules: () => call<Module[]>('/modules'),
  /** Short AI summary of a module's public description, cached on the server. */
  moduleSummary: (moduleId: string) => call<ModuleSummary>(`/modules/${encodeURIComponent(moduleId)}/summary`),
  pathways: () => call<Pathway[]>('/pathways'),
  societies: () => call<Society[]>('/societies'),
  trace: (sessionId: string) => call<TraceEvent[]>(`/trace/${encodeURIComponent(sessionId)}`),
  latestEval: () => call<EvalRun | null>('/eval/latest'),
};

/** POSTs a body and streams the SSE events back. POST bodies rule out EventSource, so the stream is parsed here. */
async function streamEvents(path: string, body: unknown, onEvent: (event: SseEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text()}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) onEvent(schemas.SseEvent.parse(JSON.parse(data)));
    }
  }
}

/** Send a student turn to the advisor and stream its SSE events back (spec 13). */
export function sendMessage(
  sessionId: string,
  body: SendMessageBody,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamEvents(`${s(sessionId)}/messages`, body, onEvent, signal);
}

/**
 * Ask the module knowledge agent a question about one module. It answers from that module's record and public
 * description only, streaming the same token, guardrail and done events as the advisor chat.
 */
export function askModule(
  sessionId: string,
  moduleId: string,
  question: string,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamEvents(`${s(sessionId)}/modules/${encodeURIComponent(moduleId)}/ask`, { question }, onEvent, signal);
}
