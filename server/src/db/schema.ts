// Drizzle schema for the twelve tables in spec section 7. JSON columns hold shared contract objects and are
// parsed with the zod schemas in repo.ts on every read. client.ts creates these tables; keep both in step.
import { integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

const sessionRef = () =>
  text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' });

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull(),
  weights: text('weights', { mode: 'json' }).notNull(),
  interview: text('interview', { mode: 'json' }).notNull(),
  escalationDraft: text('escalation_draft', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** Tables read back in insertion order carry an autoincrement `seq` alongside their contract id. */
export const messages = sqliteTable('messages', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  sessionId: sessionRef(),
  role: text('role').notNull(),
  agent: text('agent'),
  content: text('content').notNull(),
  at: text('at').notNull(),
});

export const profiles = sqliteTable('profiles', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  data: text('data', { mode: 'json' }).notNull(),
});

export const evidence = sqliteTable('evidence', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  sessionId: sessionRef(),
  turnId: text('turn_id').notNull(),
  slot: text('slot').notNull(),
  value: text('value', { mode: 'json' }).notNull(),
  quote: text('quote').notNull(),
  confidence: real('confidence').notNull(),
});

export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  department: text('department').notNull(),
  level: integer('level').notNull(),
  ects: real('ects').notNull(),
  type: text('type').notNull(),
  terms: text('terms', { mode: 'json' }).notNull(),
  description: text('description').notNull(),
  learningOutcomes: text('learning_outcomes', { mode: 'json' }).notNull(),
  sourceUrl: text('source_url').notNull(),
  prerequisites: text('prerequisites', { mode: 'json' }).notNull(),
  capacity: integer('capacity'),
  derived: text('derived', { mode: 'json' }).notNull(),
});

export const slots = sqliteTable('slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  moduleId: text('module_id').notNull(),
  term: text('term').notNull(),
  day: text('day').notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  kind: text('kind').notNull(),
  provisional: integer('provisional', { mode: 'boolean' }).notNull(),
  probability: real('probability').notNull(),
  sessionKey: text('session_key').notNull(),
});

export const shortlistItems = sqliteTable(
  'shortlist_items',
  {
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    sessionId: sessionRef(),
    moduleId: text('module_id').notNull(),
  },
  (t) => [unique('shortlist_items_session_module').on(t.sessionId, t.moduleId)],
);

export const escalations = sqliteTable('escalations', {
  id: text('id').primaryKey(),
  sessionId: sessionRef(),
  type: text('type').notNull(),
  summary: text('summary').notNull(),
  status: text('status').notNull(),
  staffResponse: text('staff_response'),
  createdAt: text('created_at').notNull(),
});

export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull(),
  kind: text('kind').notNull(),
  headline: text('headline').notNull(),
  detail: text('detail').notNull(),
  cohortSize: integer('cohort_size').notNull(),
  upliftPoints: real('uplift_points'),
  decision: text('decision').notNull(),
});

/** Not tied to sessions by a foreign key: staff actions and eval runs also write trace events. */
export const traceEvents = sqliteTable('trace_events', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  sessionId: text('session_id').notNull(),
  at: text('at').notNull(),
  actor: text('actor').notNull(),
  kind: text('kind').notNull(),
  input: text('input').notNull(),
  output: text('output').notNull(),
  verdict: text('verdict'),
  latencyMs: real('latency_ms').notNull(),
});

export const cohortProfiles = sqliteTable('cohort_profiles', {
  id: text('id').primaryKey(),
  profile: text('profile', { mode: 'json' }).notNull(),
  shortlist: text('shortlist', { mode: 'json' }).notNull(),
});

export const evalRuns = sqliteTable('eval_runs', {
  id: text('id').primaryKey(),
  at: text('at').notNull(),
  results: text('results', { mode: 'json' }).notNull(),
});

export const tables = {
  sessions,
  messages,
  profiles,
  evidence,
  modules,
  slots,
  shortlistItems,
  escalations,
  insights,
  traceEvents,
  cohortProfiles,
  evalRuns,
};
