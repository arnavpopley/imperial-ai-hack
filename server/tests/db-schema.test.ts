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

  it('creates the twelve spec tables', () => {
    expect(Object.keys(tables)).toHaveLength(12);
  });
});
