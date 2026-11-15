import type { Mode } from '@modulematch/shared';

export const paths = {
  /** The landing page for a new student. */
  onboard: '/',
  /** The landing page for anyone, including a returning student. */
  welcome: '/welcome',
  /** Programme, year and completed modules: the form that creates a session. */
  start: '/start',
  interview: '/interview',
  catalogue: '/catalogue',
  timetable: '/timetable',
  pathways: '/pathways',
  /** Tailored feedback on the student's exams (spec 23). */
  feedback: '/feedback',
  module: (moduleId: string) => `/modules/${encodeURIComponent(moduleId)}`,
} as const;

/** Spec 12: resume at the screen that matches the session's mode. */
export function routeForMode(mode: Mode): string {
  switch (mode) {
    case 'ONBOARD':
    case 'INTERVIEW':
      return paths.interview;
    case 'PLAN':
      return paths.timetable;
    case 'RECOMMEND':
    case 'EXPLAIN':
    case 'ESCALATED':
      return paths.catalogue;
  }
}

/** Navigation state that opens the interview's "Your results" panel, for "Upload a mark sheet" links. */
export const OPEN_RESULTS_STATE = { openResults: true } as const;

export function wantsResultsPanel(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'openResults' in state && state.openResults === true;
}
