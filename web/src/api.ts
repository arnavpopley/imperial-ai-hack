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
  pathways: () => call<Pathway[]>('/pathways'),
  societies: () => call<Society[]>('/societies'),
  trace: (sessionId: string) => call<TraceEvent[]>(`/trace/${encodeURIComponent(sessionId)}`),
  latestEval: () => call<EvalRun | null>('/eval/latest'),
};

/**
 * Send a student turn and stream SSE events back (spec 13). POST bodies rule out EventSource,
 * so this parses the event stream from fetch directly. Each event is validated against the schema.
 */
export async function sendMessage(
  sessionId: string,
  body: SendMessageBody,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api${s(sessionId)}/messages`, {
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
