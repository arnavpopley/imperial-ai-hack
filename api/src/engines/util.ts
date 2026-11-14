// Small helpers shared by the engines: clamping, rounding, stable ordering and display labels.
import { schemas, taxonomy } from '@modulematch/shared';
import type { Module } from '@modulematch/shared';

/** Terms in calendar order (spec 7). */
export const TERMS = schemas.Term.options;

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export const roundTo = (x: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(x * factor) / factor;
};

export const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((sum, x) => sum + x, 0) / xs.length;

/** Locale-independent string order, so every sort gives the same result on every machine. */
export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Distinct items in first-seen order. */
export const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/** Items grouped by key, with groups and their members in first-seen order. */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** Every unordered pair (a, b) with a before b in the input order. */
export const pairs = <T>(items: readonly T[]): [T, T][] =>
  items.flatMap((a, i) => items.slice(i + 1).map((b): [T, T] => [a, b]));

const TOPIC_LABELS: Record<string, { label: string }> = taxonomy.topics;

/** Human-readable taxonomy label, falling back to the raw id for keys outside the taxonomy. */
export const topicLabel = (topicId: string): string => TOPIC_LABELS[topicId]?.label ?? topicId;

/** How a module is named in student- and staff-facing text, for example "MECH60001 Advanced Fluids". */
export const moduleName = (module: Pick<Module, 'code' | 'title'>): string => `${module.code} ${module.title}`;
