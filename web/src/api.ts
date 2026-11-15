// Typed client for the API contract in spec section 13. Screens call these instead of fetch directly.
import { schemas } from '@modulematch/shared';
import type {
  ClashPriority,
  CompareView,
  CreateEscalationBody,
  DerivedEditBody,
  Escalation,
  EvalRun,
  ExplanationResponse,
  Feedback,
  FeedbackBody,
  FeedbackSummary,
  Insight,
  InsightDecisionBody,
  Module,
  ModuleDemandSignal,
  ProgrammeInfo,
  ModuleSummary,
  CvResponse,
  ExamAwaitingMarks,
  ExamFeedbackForm,
  ExamFormDraftBody,
  ExamFormSaveBody,
  PerformanceView,
  ResultsUploadResponse,
  StudentResults,
  TailoredFeedback,
  Pathway,
  PathwayProgress,
  ProfileEditBody,
  RecommendationsResponse,
  RestoreSessionBody,
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

/**
 * Fired on `window` when the API answers that it does not know the stored session. On the public demo each server
 * instance keeps its own database, so a session can vanish if a request lands on another instance or after a
 * restart. The session provider turns this into a "start again" screen instead of a dead end.
 */
export const SESSION_LOST_EVENT = 'modulematch:session-lost';

/** True for the error a request throws when the API does not know the session. */
export function isSessionLost(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('404 ') && err.message.includes('session not found');
}

/** The detail of a SESSION_LOST_EVENT: the session the failed request was for. */
export interface SessionLostDetail {
  sessionId: string;
}

/** The session a session-scoped path is for, or null for any other path. */
function sessionIdIn(path: string): string | null {
  const id = /^\/sessions\/([^/?]+)/.exec(path)?.[1];
  return id ? decodeURIComponent(id) : null;
}

/**
 * Reads a failed response's text and announces a lost session (404 "session not found") with the session it was
 * for, so a late failure from an old session never ends the new one.
 */
async function failure(res: Response, path: string): Promise<Error> {
  const err = new Error(`${res.status} ${await res.text()}`);
  const sessionId = sessionIdIn(path);
  if (sessionId && isSessionLost(err)) {
    const detail: SessionLostDetail = { sessionId };
    window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT, { detail }));
  }
  return err;
}

/** Gives the client's own copy of a session, or null when it holds none for that id. Set by the session provider. */
type SnapshotSource = (sessionId: string) => RestoreSessionBody | null;
let snapshotSource: SnapshotSource | null = null;

export function setSnapshotSource(source: SnapshotSource | null): void {
  snapshotSource = source;
}

/**
 * Restore rounds per request. Each round puts the session on one more server instance, and a retry can still land on
 * an instance that has not had it yet, so a request gets a few rounds before the session counts as lost.
 */
export const RESTORE_ROUNDS = 3;

/** Sends the client's copy of the session to whichever instance answers; true once that instance has the session. */
async function restore(sessionId: string): Promise<boolean> {
  try {
    const snapshot = snapshotSource?.(sessionId);
    if (!snapshot) return false;
    const res = await fetch(`/api${s(sessionId)}/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a request. When the server answers that it does not know the session (a demo instance that never saw it),
 * restores the session there from the client's copy and sends the request again. A 404 means the request did
 * nothing, so sending it again is safe. If a restore fails, the 404 stands and the session counts as lost.
 */
async function send(path: string, init: RequestInit): Promise<Response> {
  let res = await fetch(`/api${path}`, init);
  const sessionId = sessionIdIn(path);
  for (let round = 0; sessionId && res.status === 404 && round < RESTORE_ROUNDS; round++) {
    if (!(await res.clone().text()).includes('session not found')) break;
    if (!(await restore(sessionId))) break;
    res = await fetch(`/api${path}`, init);
  }
  return res;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await send(path, {
    method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

function s(id: string): string {
  return `/sessions/${encodeURIComponent(id)}`;
}

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
  compare: (id: string, moduleIds: readonly string[]) =>
    call<CompareView>(`${s(id)}/compare?ids=${moduleIds.map(encodeURIComponent).join(',')}`),
  escalate: (id: string, body: CreateEscalationBody) => call<Escalation>(`${s(id)}/escalations`, { body }),
  pathwayProgress: (id: string, pathwayId: string) =>
    call<PathwayProgress>(`${s(id)}/pathways/${encodeURIComponent(pathwayId)}/progress`),
  societyMatches: (id: string) => call<SocietyMatch[]>(`${s(id)}/societies`),
  /** Upload a transcript or mark sheet (PDF, image or pasted text). Consent is required with every upload. */
  uploadResults: (id: string, body: z.input<typeof schemas.ResultsUploadBody>) =>
    call<ResultsUploadResponse>(`${s(id)}/results`, { body }),
  results: (id: string) => call<StudentResults>(`${s(id)}/results`),
  /** Withdraw consent and delete every stored mark. */
  deleteResults: (id: string) => call<StudentResults>(`${s(id)}/results`, { method: 'DELETE' }),
  /** Topic strengths from the student's own marks, and informational nudges on modules (never a score change). */
  performance: (id: string) => call<PerformanceView>(`${s(id)}/performance`),
  /** Tailored feedback for each exam that has a published examiner form and the student's question marks. */
  examFeedback: (id: string) => call<TailoredFeedback[]>(`${s(id)}/exam-feedback`),
  /** Published exams the student has a mark for but no matching question marks, so no feedback yet (issue #108). */
  examAwaitingMarks: (id: string) => call<ExamAwaitingMarks[]>(`${s(id)}/exam-feedback/awaiting-marks`),
  /** Pasted CV or personal statement: redacted on the server, then mined for interests and skills. */
  submitCv: (id: string, text: string) => call<CvResponse>(`${s(id)}/cv`, { body: { text } }),
  /** Thumbs up or down on one AI answer. Free text is redacted on the server before it is stored. */
  feedback: (id: string, body: FeedbackBody) => call<Feedback>(`${s(id)}/feedback`, { body }),

  staff: {
    modules: () => call<StaffModuleSummary[]>('/staff/modules'),
    insights: (moduleId: string) => call<Insight[]>(`/staff/modules/${encodeURIComponent(moduleId)}/insights`),
    decide: (insightId: string, body: InsightDecisionBody) =>
      call<Insight>(`/staff/insights/${encodeURIComponent(insightId)}/decision`, { body }),
    editDerived: (moduleId: string, body: DerivedEditBody) =>
      call<Module>(`/staff/modules/${encodeURIComponent(moduleId)}/derived`, { method: 'PUT', body }),
    clashPriorities: () => call<ClashPriority[]>('/staff/timetable/clash-priorities'),
    /** The examiner's feedback form for a module's exam, or null when none exists yet. */
    examForm: (moduleId: string) => call<ExamFeedbackForm | null>(`/staff/modules/${encodeURIComponent(moduleId)}/exam-form`),
    saveExamForm: (moduleId: string, body: ExamFormSaveBody) =>
      call<ExamFeedbackForm>(`/staff/modules/${encodeURIComponent(moduleId)}/exam-form`, { method: 'PUT', body }),
    /** AI drafts a form from the examiner's marking notes; it stays a draft until an examiner publishes it. */
    draftExamForm: (moduleId: string, body: ExamFormDraftBody) =>
      call<ExamFeedbackForm>(`/staff/modules/${encodeURIComponent(moduleId)}/exam-form/draft`, { body }),
    publishExamForm: (moduleId: string) =>
      call<ExamFeedbackForm>(`/staff/modules/${encodeURIComponent(moduleId)}/exam-form/publish`, { body: {} }),
    escalations: () => call<StaffEscalation[]>('/staff/escalations'),
    respond: (escalationId: string, body: RespondInput) =>
      call<Escalation>(`/staff/escalations/${encodeURIComponent(escalationId)}/respond`, { body }),
    feedback: () => call<FeedbackSummary>('/staff/feedback'),
    /** JSONL download of redacted feedback rows, for eval or fine-tuning seed sets. */
    feedbackExportUrl: '/api/staff/feedback/export',
  },

  modules: () => call<Module[]>('/modules'),
  /** Near-full and oversubscribed modules from the synthetic cohort's shortlists; informational, never a score. */
  moduleDemand: () => call<ModuleDemandSignal[]>('/modules/demand'),
  /** Short AI summary of a module's public description, cached on the server. */
  moduleSummary: (moduleId: string) => call<ModuleSummary>(`/modules/${encodeURIComponent(moduleId)}/summary`),
  pathways: () => call<Pathway[]>('/pathways'),
  /** Which years of each programme have rules loaded (issue 51). */
  programmes: () => call<ProgrammeInfo[]>('/programmes'),
  societies: () => call<Society[]>('/societies'),
  trace: (sessionId: string) => call<TraceEvent[]>(`/trace/${encodeURIComponent(sessionId)}`),
  latestEval: () => call<EvalRun | null>('/eval/latest'),
};

/** POSTs a body and streams the SSE events back. POST bodies rule out EventSource, so the stream is parsed here. */
async function streamEvents(path: string, body: unknown, onEvent: (event: SseEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await send(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res, path);
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
