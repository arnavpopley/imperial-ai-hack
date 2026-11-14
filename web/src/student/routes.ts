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
