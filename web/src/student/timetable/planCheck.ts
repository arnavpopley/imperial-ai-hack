// Issue 143: the Timetable's plan check as rows of progress, not red paragraphs. An unfinished shortlist is
// progress ("15 / 25 ECTS"); only a real break (over the cap, a module not allowed, a clash) is an issue.
import type { RuleViolation, TimetableView } from '@modulematch/shared';

/** met: done. todo: on the way. issue: something is broken. note: worth knowing, never blocking. */
export type CheckState = 'met' | 'todo' | 'issue' | 'note';

export interface PlanCheckRow {
  id: 'clashes' | 'keep-free' | 'electives' | 'i-explore' | 'cap' | 'allowed' | 'rules' | 'balance';
  label: string;
  state: CheckState;
  /** The short value on the right, for example "15 / 25 ECTS" or "None". */
  value: string;
  /** 0 to 1, drawn as a meter, for the credit rows. */
  progress?: number;
}

/** Violations a student fixes by choosing more, which are progress, not breaks. */
const PROGRESS_CODES: ReadonlySet<RuleViolation['code']> = new Set(['ELECTIVE_ECTS_SHORT', 'I_EXPLORE_MISSING']);
/** Violations that mean a shortlisted module cannot be taken. */
const ELIGIBILITY_CODES: ReadonlySet<RuleViolation['code']> = new Set([
  'PREREQUISITE_MISSING',
  'NOT_ALLOWED',
  'UNKNOWN_MODULE',
  'ABOVE_YEAR_LEVEL',
]);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function planChecks(view: TimetableView): PlanCheckRow[] {
  const { ects, rules, clashes, keepFree, keepFreeConflicts } = view;
  const has = (code: RuleViolation['code']) => rules.violations.some((v) => v.code === code);
  const rows: PlanCheckRow[] = [];

  rows.push({
    id: 'clashes',
    label: 'Clashes',
    state: clashes.length > 0 ? 'issue' : 'met',
    value: clashes.length > 0 ? `${clashes.length} to resolve` : 'None',
  });
  if (keepFree.length > 0) {
    rows.push({
      id: 'keep-free',
      label: 'Kept-free time',
      state: keepFreeConflicts.length > 0 ? 'note' : 'met',
      value: keepFreeConflicts.length > 0 ? `${plural(keepFreeConflicts.length, 'session')} in it` : 'Stays free',
    });
  }

  const rulesLoaded = ects.max !== null && !has('RULES_NOT_LOADED');
  if (ects.electiveRequired !== null && ects.electiveRequired > 0) {
    const chosen = ects.elective + ects.iExplore;
    rows.push({
      id: 'electives',
      label: 'Electives and I-Explore',
      state: has('ELECTIVE_ECTS_SHORT') ? 'todo' : 'met',
      value: `${chosen} / ${ects.electiveRequired} ECTS`,
      progress: Math.min(1, chosen / ects.electiveRequired),
    });
  }
  if (ects.iExploreRequired) {
    const met = !has('I_EXPLORE_MISSING');
    rows.push({ id: 'i-explore', label: 'I-Explore module', state: met ? 'met' : 'todo', value: `${met ? 1 : 0} / 1` });
  }
  if (ects.max !== null) {
    const total = ects.core + ects.elective + ects.iExplore;
    const over = has('ECTS_CAP_EXCEEDED');
    rows.push({
      id: 'cap',
      label: 'Credit cap',
      state: over ? 'issue' : 'met',
      value: over ? `${total - ects.max} ECTS over ${ects.max}` : `${total} / ${ects.max} ECTS`,
      progress: Math.min(1, total / ects.max),
    });
  }
  const notAllowed = new Set(rules.violations.filter((v) => ELIGIBILITY_CODES.has(v.code)).map((v) => v.moduleId ?? v.code));
  if (rulesLoaded || notAllowed.size > 0) {
    rows.push({
      id: 'allowed',
      label: 'Modules you can take',
      state: notAllowed.size > 0 ? 'issue' : 'met',
      value: notAllowed.size > 0 ? `${plural(notAllowed.size, 'module')} not allowed` : 'All of them',
    });
  }
  if (!rulesLoaded) {
    rows.push({ id: 'rules', label: 'Programme rules', state: 'note', value: 'Not loaded for your year' });
  }
  if (rules.warnings.some((w) => w.code === 'TERM_IMBALANCE')) {
    rows.push({ id: 'balance', label: 'Term balance', state: 'note', value: 'One term is heavy' });
  }
  return rows;
}

/** The rule messages behind the rows, for the disclosure, with breaks first and progress last. */
export function ruleDetails(view: TimetableView): string[] {
  const breaks = view.rules.violations.filter((v) => !PROGRESS_CODES.has(v.code));
  const progress = view.rules.violations.filter((v) => PROGRESS_CODES.has(v.code));
  return [...breaks, ...view.rules.warnings, ...progress].map((r) => r.message);
}
