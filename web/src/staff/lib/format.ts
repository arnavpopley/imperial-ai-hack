// Small presentation helpers shared by the staff screens.
import { LIKELY_CLASH_THRESHOLD, taxonomy } from '@modulematch/shared';
import type { ClashLabel } from '@modulematch/shared';

/** Keyboard focus ring used by every interactive staff control. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand focus-visible:outline-solid';

export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

export const weight = (value: number) => value.toFixed(2);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function topicLabel(id: string): string {
  return Object.hasOwn(taxonomy.topics, id) ? taxonomy.topics[id as keyof typeof taxonomy.topics].label : id;
}

export function skillLabel(id: string): string {
  return Object.hasOwn(taxonomy.skills, id) ? taxonomy.skills[id as keyof typeof taxonomy.skills].label : id;
}

/** "energy-transition" to "Energy transition", for ids with no catalogue label. */
export function humanise(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Spec 9.2: certain when P = 1, likely when 0.3 <= P < 1, possible otherwise. */
export function clashLabel(probability: number): ClashLabel {
  if (probability >= 1) return 'certain';
  if (probability >= LIKELY_CLASH_THRESHOLD) return 'likely';
  return 'possible';
}

export type CapacityStatus = 'uncapped' | 'within' | 'near' | 'over';

export const CAPACITY_LABEL: Record<CapacityStatus, string> = {
  uncapped: 'No capacity limit',
  within: 'Within capacity',
  near: 'Near capacity',
  over: 'Over capacity',
};

/** Share of capacity at which demand turns amber. */
export const NEAR_CAPACITY = 0.85;

export function capacityStatus(shortlisted: number, capacity: number | null): CapacityStatus {
  if (capacity === null) return 'uncapped';
  const ratio = shortlisted / capacity;
  if (ratio > 1) return 'over';
  if (ratio >= NEAR_CAPACITY) return 'near';
  return 'within';
}

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const clock = new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' });

export const formatDateTime = (iso: string) => absolute.format(new Date(iso));
export const formatClock = (date: Date) => clock.format(date);

/** "3 minutes ago", falling back to the absolute date after a week. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, 'second');
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 604800) return relative.format(Math.round(seconds / 86400), 'day');
  return formatDateTime(iso);
}

/** Rounds up to a 1, 2 or 5 step so chart axes end on a readable number. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}
