// Compare selection and wording for the catalogue (issue 62). Pure helpers, so they are easy to test.
import type { Slot } from '@modulematch/shared';
import { DAY_LABELS, TERM_LABELS, TERMS, WEEKDAYS } from '../labels.ts';

/** Modules compared at once. */
export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

/** Each compared module keeps a letter and a colour, so its values read across every row. */
export const COMPARE_LETTERS = ['A', 'B', 'C'] as const;
export const COMPARE_DOT = ['bg-module-1', 'bg-module-2', 'bg-module-3'] as const;

/** Adds or removes a module, keeping the order of selection; a fourth module is not added. */
export function toggleCompare(selected: readonly string[], moduleId: string): string[] {
  if (selected.includes(moduleId)) return selected.filter((id) => id !== moduleId);
  return selected.length >= MAX_COMPARE ? [...selected] : [...selected, moduleId];
}

/** The question the advisor gets, naming each module by code so the Catalogue agent's compare tool picks them up. */
export function advisorPrompt(codes: readonly string[]): string {
  const names = codes.length > 1 ? `${codes.slice(0, -1).join(', ')} and ${codes.at(-1)}` : (codes[0] ?? '');
  return `Compare ${names}: which suits me best?`;
}

/** "Tue 14:00–16:00 lecture", with "(provisional)" when the time is not confirmed yet. */
export function slotLine(slot: Pick<Slot, 'day' | 'start' | 'end' | 'kind' | 'provisional'>): string {
  return `${DAY_LABELS[slot.day]} ${slot.start}–${slot.end} ${slot.kind}${slot.provisional ? ' (provisional)' : ''}`;
}

/**
 * A module's sessions as one line per term in calendar order, each distinct time once, confirmed times first. Long lists are cut
 * to `limit` times per term with a count of the rest.
 */
export function timetableLines(slots: readonly Slot[], limit = 3): { term: string; times: string[]; more: number }[] {
  const terms = TERMS.filter((term) => slots.some((s) => s.term === term));
  return terms.map((term) => {
    const times = [
      ...new Set(
        slots
          .filter((s) => s.term === term)
          .sort((a, b) => Number(a.provisional) - Number(b.provisional) || WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.start.localeCompare(b.start))
          .map(slotLine),
      ),
    ];
    return { term: TERM_LABELS[term], times: times.slice(0, limit), more: Math.max(0, times.length - limit) };
  });
}
