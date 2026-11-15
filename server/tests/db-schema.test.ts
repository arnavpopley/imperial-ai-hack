// WS1: the hand-written CREATE TABLE statements in client.ts match the Drizzle schema in schema.ts.
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/client.ts';
import { tables } from '../src/db/schema.ts';

describe('database schema', () => {
  const db = openDb(':memory:');
  const columnsOf = (name: string) =>
    (db.$client.pragma(`table_info(${name})`) as { name: string }[]).map((c) => c.name).sort();

  it.each(Object.values(tables).map((t: SQLiteTable) => [getTableConfig(t).name, t] as const))(
    '%s has the same columns in DDL and Drizzle',
    (name, table) => {
      expect(columnsOf(name)).toEqual(getTableConfig(table).columns.map((c) => c.name).sort());
    },
  );

  it('creates the twelve spec tables plus feedback, results consent, module results and exam forms', () => {
    expect(Object.keys(tables)).toHaveLength(16);
  });
});

describe('legacy database location', () => {
  it('moves the database and its WAL files from api/ to server/ once, and never overwrites', async () => {
    const { mkdtempSync, writeFileSync, existsSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { migrateLegacyDatabase } = await import('../src/db/client.ts');
    const dir = mkdtempSync(join(tmpdir(), 'mm-db-'));
    const legacy = join(dir, 'legacy.db');
    const target = join(dir, 'target.db');
    writeFileSync(legacy, 'old');
    writeFileSync(`${legacy}-wal`, 'wal');
    expect(migrateLegacyDatabase(legacy, target)).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe('old');
    expect(readFileSync(`${target}-wal`, 'utf8')).toBe('wal');
    expect(existsSync(legacy)).toBe(false);
    writeFileSync(legacy, 'another');
    expect(migrateLegacyDatabase(legacy, target)).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('old');
  });
});
