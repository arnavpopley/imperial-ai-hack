// Human labels for taxonomy keys, profile slots, terms and days.
import { taxonomy, type Evidence, type Style, type Term, type Weekday } from '@modulematch/shared';

const topics: Record<string, { label: string }> = taxonomy.topics;
const skills: Record<string, { label: string }> = taxonomy.skills;

/** "fluid-mechanics" to "Fluid mechanics", for keys outside the taxonomy. */
export function humanise(key: string): string {
  const spaced = key.replace(/[-_.]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const topicLabel = (id: string): string => topics[id]?.label ?? humanise(id);
export const skillLabel = (id: string): string => skills[id]?.label ?? humanise(id);

export const TERMS: readonly Term[] = ['autumn', 'spring', 'summer'];
export const TERM_LABELS: Record<Term, string> = { autumn: 'Autumn', spring: 'Spring', summer: 'Summer' };

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const DAY_LABELS: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
export const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

const isWeekday = (value: string): value is Weekday => value in DAY_NAMES;

export type StyleKey = keyof Style;

/** Each style dimension with the words at either end of its scale (spec 8.3). */
export const STYLE_META: Record<StyleKey, { label: string; low: string; high: string }> = {
  examPreference: { label: 'Assessment', low: 'Coursework', high: 'Exams' },
  groupPreference: { label: 'Working style', low: 'Solo', high: 'Team' },
  appliedPreference: { label: 'Theory or applied', low: 'Theory', high: 'Applied' },
  mathsComfort: { label: 'Maths comfort', low: 'Prefer to avoid', high: 'Very comfortable' },
  codingComfort: { label: 'Coding comfort', low: 'Prefer to avoid', high: 'Very comfortable' },
  workloadTolerance: { label: 'Workload', low: 'Lighter', high: 'Heavy is fine' },
};

export const STYLE_KEYS = Object.keys(STYLE_META) as StyleKey[];

export function isStyleKey(key: string): key is StyleKey {
  return key in STYLE_META;
}

/** A readable label for an evidence slot such as "interest:fluid-mechanics" or "style.mathsComfort". */
export function slotLabel(slot: string): string {
  if (slot.startsWith('interest:')) return `Interest: ${topicLabel(slot.slice('interest:'.length))}`;
  if (slot.startsWith('style.')) {
    const key = slot.slice('style.'.length);
    return isStyleKey(key) ? STYLE_META[key].label : humanise(key);
  }
  switch (slot) {
    case 'breadthAppetite':
      return 'Appetite for breadth';
    case 'pathways':
      return 'Career pathways';
    case 'pathwaysSkipped':
      return 'Pathways skipped';
    case 'timetablePrefs.avoidDays':
      return 'Days to keep free';
    case 'timetablePrefs.earliestStart':
      return 'Earliest start';
    default:
      return humanise(slot);
  }
}

/** Renders any of the four evidence value shapes (number, string, boolean, string list). */
export function formatEvidenceValue(value: Evidence['value']): string {
  if (typeof value === 'number') return `${Math.round(value * 100)}%`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((v) => (isWeekday(v) ? DAY_NAMES[v] : humanise(v))).join(', ');
  }
  return value;
}

/** The most recent evidence for a slot. Evidence arrives in order, so the last match wins. */
export function latestEvidence(evidence: readonly Evidence[], slot: string): Evidence | undefined {
  return evidence.findLast((e) => e.slot === slot);
}

/** Capability dimensions only penalise a module that demands more than the student offers (spec 8.3). */
const CAPABILITY_KEYS: ReadonlySet<StyleKey> = new Set(['mathsComfort', 'codingComfort', 'workloadTolerance']);

/** Words for a style value: a level for capabilities, a lean for two-ended preferences. */
export function styleValueText(key: StyleKey, value: number): string {
  if (CAPABILITY_KEYS.has(key)) return value < 0.35 ? 'Low' : value < 0.7 ? 'Moderate' : 'High';
  const { low, high } = STYLE_META[key];
  if (value <= 0.2) return `Strongly ${low.toLowerCase()}`;
  if (value < 0.4) return `Leans ${low.toLowerCase()}`;
  if (value <= 0.6) return 'Balanced';
  if (value < 0.8) return `Leans ${high.toLowerCase()}`;
  return `Strongly ${high.toLowerCase()}`;
}

export const percent = (value: number): string => `${Math.round(value * 100)}%`;
