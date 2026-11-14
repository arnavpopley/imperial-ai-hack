// Opens the SQLite database and creates the tables in schema.ts if they do not exist yet.
import { existsSync, renameSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { REPO_ROOT } from './datasets.ts';
import { tables } from './schema.ts';

export type Db = BetterSQLite3Database<typeof tables> & { $client: Database.Database };

/** Hand-written DDL kept in step with schema.ts (db-schema.test.ts checks the column names match). */
const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  weights TEXT NOT NULL,
  interview TEXT NOT NULL,
  escalation_draft TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  agent TEXT,
  content TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  value TEXT NOT NULL,
  quote TEXT NOT NULL,
  confidence REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  level INTEGER NOT NULL,
  ects REAL NOT NULL,
  type TEXT NOT NULL,
  terms TEXT NOT NULL,
  description TEXT NOT NULL,
  learning_outcomes TEXT NOT NULL,
  source_url TEXT NOT NULL,
  prerequisites TEXT NOT NULL,
  capacity INTEGER,
  derived TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id TEXT NOT NULL,
  term TEXT NOT NULL,
  day TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  kind TEXT NOT NULL,
  provisional INTEGER NOT NULL,
  probability REAL NOT NULL,
  session_key TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shortlist_items (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  CONSTRAINT shortlist_items_session_module UNIQUE (session_id, module_id)
);
CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  staff_response TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  headline TEXT NOT NULL,
  detail TEXT NOT NULL,
  cohort_size INTEGER NOT NULL,
  uplift_points REAL,
  decision TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trace_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  verdict TEXT,
  latency_ms REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS cohort_profiles (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  shortlist TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  results TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  module_id TEXT,
  rating TEXT NOT NULL,
  reason TEXT,
  comment TEXT,
  question TEXT,
  answer_excerpt TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT feedback_session_target UNIQUE (session_id, target_kind, target_id)
);
CREATE INDEX IF NOT EXISTS messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS evidence_session ON evidence(session_id);
CREATE INDEX IF NOT EXISTS escalations_session ON escalations(session_id);
CREATE INDEX IF NOT EXISTS insights_module ON insights(module_id);
CREATE INDEX IF NOT EXISTS trace_events_session ON trace_events(session_id);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created_at);
`;

/** Default database file, relative to the repository root (spec section 5). */
const DEFAULT_DATABASE_PATH = 'server/modulematch.db';

/** Where the default database lived before the backend moved from api/ to server/. */
const LEGACY_DATABASE_PATH = 'api/modulematch.db';

/**
 * Moves a database (with its WAL and shared-memory files) from `legacy` to `target`, once: only when the legacy
 * file exists and the target does not. Keeps saved sessions after the api/ to server/ rename. Returns whether it moved.
 */
export function migrateLegacyDatabase(legacy: string, target: string): boolean {
  if (!existsSync(legacy) || existsSync(target)) return false;
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${legacy}${suffix}`)) renameSync(`${legacy}${suffix}`, `${target}${suffix}`);
  }
  return true;
}

/** DATABASE_PATH if set, else the default; relative paths resolve against the repo root, not the cwd. */
export function databasePath(): string {
  const configured = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
  if (configured === ':memory:' || isAbsolute(configured)) return configured;
  return resolve(REPO_ROOT, configured);
}

/** Open a database (a file path or ':memory:'), enable WAL and foreign keys, and create missing tables. */
export function openDb(path: string): Db {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(CREATE_TABLES);
  return drizzle({ client: sqlite, schema: tables });
}

let shared: Db | null = null;

/** The process-wide database at databasePath(), opened on first use. */
export function getDb(): Db {
  if (!shared) {
    // Only the default location moves; an explicit DATABASE_PATH is always used as given.
    if (process.env.DATABASE_PATH === undefined) {
      migrateLegacyDatabase(resolve(REPO_ROOT, LEGACY_DATABASE_PATH), resolve(REPO_ROOT, DEFAULT_DATABASE_PATH));
    }
    shared = openDb(databasePath());
  }
  return shared;
}
