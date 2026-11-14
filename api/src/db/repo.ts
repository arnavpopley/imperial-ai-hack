// Typed repository over the SQLite tables. Every read is parsed with the shared zod schemas, so callers
// always get valid contract objects. Each function takes the database as an optional last argument
// (default: the shared getDb() instance) so tests can pass an ':memory:' database from openDb().
import {
  type Escalation,
  type EvalRun,
  type Evidence,
  type Insight,
  type InsightDecision,
  type Message,
  type Module,
  type ModuleDerived,
  type SessionState,
  type Slot,
  type StudentProfile,
  type TraceEvent,
  schemas as S,
} from '@modulematch/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Db, getDb } from './client.ts';
import type { CohortStudent } from './datasets.ts';
import {
  cohortProfiles,
  escalations,
  evalRuns,
  evidence,
  insights,
  messages,
  modules,
  profiles,
  sessions,
  shortlistItems,
  slots,
  traceEvents,
} from './schema.ts';

const now = () => new Date().toISOString();

// ---------- modules and slots ----------

type ModuleRow = typeof modules.$inferSelect;

function toModule(row: ModuleRow): Module {
  return S.Module.parse({
    id: row.id,
    code: row.code,
    title: row.title,
    department: row.department,
    level: row.level,
    ects: row.ects,
    type: row.type,
    terms: row.terms,
    description: row.description,
    learningOutcomes: row.learningOutcomes,
    sourceUrl: row.sourceUrl,
    prerequisites: row.prerequisites,
    capacity: row.capacity,
    ...S.ModuleDerived.parse(row.derived),
  });
}

function toModuleRow(m: Module): ModuleRow {
  const { topics, skills, pathwayRelevance, demand, derivedBy, derivedRationale, ...raw } = S.Module.parse(m);
  return { ...raw, derived: { topics, skills, pathwayRelevance, demand, derivedBy, derivedRationale } };
}

/** Replace the whole module catalogue (used by the seed script). */
export function replaceModules(list: Module[], db: Db = getDb()): void {
  const rows = list.map(toModuleRow);
  db.transaction((tx) => {
    tx.delete(modules).run();
    if (rows.length > 0) tx.insert(modules).values(rows).run();
  });
}

export function listModules(db: Db = getDb()): Module[] {
  return db.select().from(modules).orderBy(asc(modules.id)).all().map(toModule);
}

export function getModule(id: string, db: Db = getDb()): Module | null {
  const row = db.select().from(modules).where(eq(modules.id, id)).get();
  return row ? toModule(row) : null;
}

/** Staff correction of derived tags (spec 10.4). Provided fields replace the stored ones; derivedBy becomes 'staff-edit'. */
export function updateModuleDerived(
  id: string,
  patch: Partial<Omit<ModuleDerived, 'derivedBy'>>,
  db: Db = getDb(),
): Module | null {
  const current = getModule(id, db);
  if (!current) return null;
  const derived = S.ModuleDerived.parse({
    topics: patch.topics ?? current.topics,
    skills: patch.skills ?? current.skills,
    pathwayRelevance: patch.pathwayRelevance ?? current.pathwayRelevance,
    demand: patch.demand ?? current.demand,
    derivedRationale: patch.derivedRationale ?? current.derivedRationale,
    derivedBy: 'staff-edit',
  });
  db.update(modules).set({ derived }).where(eq(modules.id, id)).run();
  return getModule(id, db);
}

type SlotRow = typeof slots.$inferSelect;

function toSlot({ id: _rowId, ...slot }: SlotRow): Slot {
  return S.Slot.parse(slot);
}

/** Replace every timetable slot (used by the seed script). */
export function replaceSlots(list: Slot[], db: Db = getDb()): void {
  const rows = list.map((s) => S.Slot.parse(s));
  db.transaction((tx) => {
    tx.delete(slots).run();
    if (rows.length > 0) tx.insert(slots).values(rows).run();
  });
}

export function listSlots(db: Db = getDb()): Slot[] {
  return db.select().from(slots).orderBy(asc(slots.id)).all().map(toSlot);
}

// ---------- sessions ----------

/** Create a session and everything it holds (profile, evidence, messages, shortlist, escalations). */
export function createSession(state: SessionState, db: Db = getDb()): SessionState {
  const s = S.SessionState.parse(state);
  db.transaction((tx) => {
    tx.insert(sessions)
      .values({
        id: s.id,
        mode: s.mode,
        weights: s.weights,
        interview: s.interview,
        escalationDraft: s.escalationDraft,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })
      .run();
    tx.insert(profiles).values({ sessionId: s.id, data: s.profile }).run();
    if (s.evidence.length > 0) tx.insert(evidence).values(s.evidence).run();
    if (s.messages.length > 0) tx.insert(messages).values(s.messages).run();
    if (s.shortlist.length > 0) {
      tx.insert(shortlistItems)
        .values(s.shortlist.map((moduleId) => ({ sessionId: s.id, moduleId })))
        .onConflictDoNothing()
        .run();
    }
    if (s.escalations.length > 0) tx.insert(escalations).values(s.escalations).run();
  });
  return requireSession(s.id, db);
}

/** The full session state for resume, assembled from every table, or null when the id is unknown. */
export function getSession(id: string, db: Db = getDb()): SessionState | null {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) return null;
  const profile = db.select().from(profiles).where(eq(profiles.sessionId, id)).get();
  if (!profile) throw new Error(`Session ${id} has no profile row`);
  return S.SessionState.parse({
    id: row.id,
    mode: row.mode,
    profile: profile.data,
    evidence: listEvidence(id, db),
    messages: listMessages(id, db),
    weights: row.weights,
    shortlist: listShortlist(id, db),
    interview: row.interview,
    escalations: listEscalations(id, db),
    escalationDraft: row.escalationDraft,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function requireSession(id: string, db: Db): SessionState {
  const state = getSession(id, db);
  if (!state) throw new Error(`Session ${id} not found`);
  return state;
}

function touchSession(id: string, db: Db): void {
  db.update(sessions).set({ updatedAt: now() }).where(eq(sessions.id, id)).run();
}

type SessionPatch = Partial<Pick<SessionState, 'mode' | 'weights' | 'interview' | 'escalationDraft'>>;

/** Update the session-level fields; returns the new state, or null when the id is unknown. */
export function updateSession(id: string, patch: SessionPatch, db: Db = getDb()): SessionState | null {
  const p = S.SessionState.pick({ mode: true, weights: true, interview: true, escalationDraft: true })
    .partial()
    .parse(patch);
  const result = db
    .update(sessions)
    .set({ ...p, updatedAt: now() })
    .where(eq(sessions.id, id))
    .run();
  return result.changes > 0 ? requireSession(id, db) : null;
}

// ---------- profile and evidence ----------

export function saveProfile(sessionId: string, profile: StudentProfile, db: Db = getDb()): StudentProfile {
  const data = S.StudentProfile.parse(profile);
  db.insert(profiles).values({ sessionId, data }).onConflictDoUpdate({ target: profiles.sessionId, set: { data } }).run();
  touchSession(sessionId, db);
  return data;
}

/**
 * Spec 20.3: the student deletes their profile and evidence. The profile is reset to an empty one that keeps
 * only the onboarding answers (programme, year, completed modules), so the session can still be resumed.
 */
export function deleteProfileAndEvidence(sessionId: string, db: Db = getDb()): StudentProfile | null {
  const row = db.select().from(profiles).where(eq(profiles.sessionId, sessionId)).get();
  if (!row) return null;
  const old = S.StudentProfile.parse(row.data);
  const blank: StudentProfile = {
    studentId: old.studentId,
    programme: old.programme,
    yearOfStudy: old.yearOfStudy,
    completedModuleIds: old.completedModuleIds,
    interests: {},
    pathways: [],
    pathwaysSkipped: false,
    style: {
      examPreference: null,
      groupPreference: null,
      appliedPreference: null,
      mathsComfort: null,
      codingComfort: null,
      workloadTolerance: null,
    },
    breadthAppetite: null,
    timetablePrefs: { avoidDays: [], earliestStart: null },
    completeness: 0,
    updatedAt: now(),
  };
  db.transaction((tx) => {
    tx.delete(evidence).where(eq(evidence.sessionId, sessionId)).run();
    tx.update(profiles).set({ data: blank }).where(eq(profiles.sessionId, sessionId)).run();
    tx.update(sessions).set({ updatedAt: blank.updatedAt }).where(eq(sessions.id, sessionId)).run();
  });
  return blank;
}

export function addEvidence(items: Evidence[], db: Db = getDb()): void {
  const rows = items.map((e) => S.Evidence.parse(e));
  if (rows.length > 0) db.insert(evidence).values(rows).run();
}

export function listEvidence(sessionId: string, db: Db = getDb()): Evidence[] {
  return db
    .select()
    .from(evidence)
    .where(eq(evidence.sessionId, sessionId))
    .orderBy(asc(evidence.seq))
    .all()
    .map(({ seq: _seq, ...e }) => S.Evidence.parse(e));
}

// ---------- messages ----------

export function addMessage(msg: Message, db: Db = getDb()): Message {
  const row = S.Message.parse(msg);
  db.insert(messages).values(row).run();
  touchSession(row.sessionId, db);
  return row;
}

export function listMessages(sessionId: string, db: Db = getDb()): Message[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.seq))
    .all()
    .map(({ seq: _seq, ...m }) => S.Message.parse(m));
}

// ---------- shortlist ----------

/** Add a module to the shortlist (a no-op if it is already there) and return the shortlist in insertion order. */
export function addToShortlist(sessionId: string, moduleId: string, db: Db = getDb()): string[] {
  db.insert(shortlistItems).values({ sessionId, moduleId }).onConflictDoNothing().run();
  touchSession(sessionId, db);
  return listShortlist(sessionId, db);
}

export function removeFromShortlist(sessionId: string, moduleId: string, db: Db = getDb()): string[] {
  db.delete(shortlistItems)
    .where(and(eq(shortlistItems.sessionId, sessionId), eq(shortlistItems.moduleId, moduleId)))
    .run();
  touchSession(sessionId, db);
  return listShortlist(sessionId, db);
}

export function listShortlist(sessionId: string, db: Db = getDb()): string[] {
  return db
    .select({ moduleId: shortlistItems.moduleId })
    .from(shortlistItems)
    .where(eq(shortlistItems.sessionId, sessionId))
    .orderBy(asc(shortlistItems.seq))
    .all()
    .map((r) => r.moduleId);
}

// ---------- escalations ----------

export function createEscalation(e: Escalation, db: Db = getDb()): Escalation {
  const row = S.Escalation.parse(e);
  db.insert(escalations).values(row).run();
  return row;
}

/** Escalations for one session, or the whole staff queue when sessionId is omitted; oldest first. */
export function listEscalations(sessionId?: string, db: Db = getDb()): Escalation[] {
  return db
    .select()
    .from(escalations)
    .where(sessionId === undefined ? undefined : eq(escalations.sessionId, sessionId))
    .orderBy(asc(escalations.createdAt))
    .all()
    .map((r) => S.Escalation.parse(r));
}

type EscalationPatch = Partial<Pick<Escalation, 'status' | 'staffResponse' | 'summary'>>;

export function updateEscalation(id: string, patch: EscalationPatch, db: Db = getDb()): Escalation | null {
  const p = S.Escalation.pick({ status: true, staffResponse: true, summary: true }).partial().parse(patch);
  db.update(escalations).set(p).where(eq(escalations.id, id)).run();
  const row = db.select().from(escalations).where(eq(escalations.id, id)).get();
  return row ? S.Escalation.parse(row) : null;
}

// ---------- insights ----------

/** Insert or refresh insight cards. A refresh keeps the staff decision already recorded for that id. */
export function upsertInsights(list: Insight[], db: Db = getDb()): void {
  const rows = list.map((i) => S.Insight.parse(i));
  db.transaction((tx) => {
    for (const row of rows) {
      const { id: _id, decision: _decision, ...content } = row;
      tx.insert(insights).values(row).onConflictDoUpdate({ target: insights.id, set: content }).run();
    }
  });
}

export function listInsights(moduleId: string, db: Db = getDb()): Insight[] {
  return db
    .select()
    .from(insights)
    .where(eq(insights.moduleId, moduleId))
    .orderBy(asc(insights.id))
    .all()
    .map((r) => S.Insight.parse(r));
}

export function setInsightDecision(id: string, decision: InsightDecision, db: Db = getDb()): Insight | null {
  db.update(insights).set({ decision: S.InsightDecision.parse(decision) }).where(eq(insights.id, id)).run();
  const row = db.select().from(insights).where(eq(insights.id, id)).get();
  return row ? S.Insight.parse(row) : null;
}

// ---------- trace ----------

export function addTraceEvent(e: TraceEvent, db: Db = getDb()): TraceEvent {
  const row = S.TraceEvent.parse(e);
  db.insert(traceEvents).values(row).run();
  return row;
}

export function listTraceEvents(sessionId: string, db: Db = getDb()): TraceEvent[] {
  return db
    .select()
    .from(traceEvents)
    .where(eq(traceEvents.sessionId, sessionId))
    .orderBy(asc(traceEvents.seq))
    .all()
    .map(({ seq: _seq, ...e }) => S.TraceEvent.parse(e));
}

// ---------- synthetic cohort ----------

/** Replace the synthetic cohort (used by the seed script). Rows are keyed by profile.studentId. */
export function replaceCohort(students: CohortStudent[], db: Db = getDb()): void {
  const rows = students.map(({ profile, shortlist }) => ({
    id: profile.studentId,
    profile: S.StudentProfile.parse(profile),
    shortlist,
  }));
  db.transaction((tx) => {
    tx.delete(cohortProfiles).run();
    if (rows.length > 0) tx.insert(cohortProfiles).values(rows).run();
  });
}

const ModuleIdList = z.array(z.string());

export function listCohort(db: Db = getDb()): CohortStudent[] {
  return db
    .select()
    .from(cohortProfiles)
    .orderBy(asc(cohortProfiles.id))
    .all()
    .map((r) => ({ profile: S.StudentProfile.parse(r.profile), shortlist: ModuleIdList.parse(r.shortlist) }));
}

// ---------- evaluation runs ----------

export function saveEvalRun(run: EvalRun, db: Db = getDb()): EvalRun {
  const row = S.EvalRun.parse(run);
  db.insert(evalRuns).values(row).run();
  return row;
}

export function latestEvalRun(db: Db = getDb()): EvalRun | null {
  const row = db.select().from(evalRuns).orderBy(desc(evalRuns.at)).limit(1).get();
  return row ? S.EvalRun.parse(row) : null;
}
