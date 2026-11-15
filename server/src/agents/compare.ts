// The catalogue's compare view (issue 62): two or three modules side by side. It reuses the Catalogue agent's
// compare_modules tool for the module facts and adds the published assessment split and the timetable engine's
// clashes against the student's shortlist. Numbers come from the records and the engines; no model is called.
import type { CompareModule, CompareView, SessionState } from '@modulematch/shared';
import { coreInPlan, findClashes } from '../engines/index.ts';
import { compareModules } from './catalogue.ts';
import { catalogue, moduleTitle, rulesForProfile } from './session.ts';

type Component = { type: 'examination' | 'coursework' | 'practical'; weighting: number };

/**
 * Whole percentages for exam, coursework and practical that add up to 100. The published weighted components
 * are used when the page lists any; otherwise the split is estimated from the record's exam share.
 */
export function assessmentSplit(published: readonly Component[], examShare: number): CompareModule['assessment'] {
  const total = published.reduce((sum, c) => sum + c.weighting, 0);
  if (total <= 0) {
    const exam = Math.round(examShare * 100);
    return { exam, coursework: 100 - exam, practical: 0, source: 'estimated' };
  }
  const share = (type: Component['type']) =>
    Math.round((100 * published.filter((c) => c.type === type).reduce((sum, c) => sum + c.weighting, 0)) / total);
  const exam = share('examination');
  const practical = Math.min(100 - exam, share('practical'));
  return { exam, coursework: 100 - exam - practical, practical, source: 'published' };
}

export type CompareError = { error: string; reason: 'unknown' | 'duplicate' };

/**
 * The compare view for two or three module ids or codes. Errors name any module that is not in the catalogue,
 * or say the same module was asked for twice (also when an id and a code name it).
 */
export function compareView(session: SessionState, ids: readonly string[]): CompareView | CompareError {
  const facts = compareModules(session, [...ids], []);
  if ('error' in facts) return { error: facts.error ?? 'Not in the catalogue.', reason: 'unknown' };
  if (new Set(facts.modules.map((m) => m.id)).size !== facts.modules.length) {
    return { error: 'Compare two or three different modules.', reason: 'duplicate' };
  }
  const slots = catalogue.slots();
  const core = coreInPlan(rulesForProfile(session.profile), session.profile);
  const coreSet = new Set(core);
  return {
    modules: facts.modules.map((m): CompareModule => {
      const record = catalogue.modules().find((x) => x.id === m.id)!;
      const clashes = findClashes([m.id, ...session.shortlist.filter((id) => id !== m.id)], slots, core)
        .filter((c) => c.moduleA === m.id || c.moduleB === m.id)
        .map((c) => {
          const other = c.moduleA === m.id ? c.moduleB : c.moduleA;
          return { withModuleId: other, withTitle: moduleTitle(other), core: coreSet.has(other), term: c.term, label: c.label, probability: c.probability };
        });
      return {
        moduleId: m.id,
        code: m.code,
        title: m.title,
        ects: m.ects,
        terms: m.terms,
        assessment: assessmentSplit(m.publishedAssessment, record.demand.examShare),
        mathsPercent: m.mathsIntensityPercent,
        codingPercent: m.codingIntensityPercent,
        workloadPercent: m.workloadPercent,
        topics: m.topTopics,
        prerequisites: record.prerequisites.map((id) => ({ moduleId: id, title: moduleTitle(id) })),
        slots: slots.filter((s) => s.moduleId === m.id),
        clashes,
      };
    }),
  };
}
