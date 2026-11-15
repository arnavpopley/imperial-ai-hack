// "Download my plan" (issue 63): a one-page printable copy of the plan, shown only when printing. The browser's
// print dialog saves it as a PDF, so nothing leaves the browser except through the student's own action.
import type { Recommendation, TimetableView, Weights } from '@modulematch/shared';
import { createPortal } from 'react-dom';
import { SUB_SCORE_LABELS } from '../../components/SubScoreBars.tsx';
import { CLASH_LABELS } from '../../components/ClashMarker.tsx';
import { DAY_NAMES, keepFreeLabel } from '../labels.ts';
import { byDay, PROVISIONAL_NOTE, termLabel } from './exportPlan.ts';

interface PlanPrintProps {
  view: TimetableView;
  shortlist: readonly string[];
  fitOf: (moduleId: string) => Pick<Recommendation, 'fit' | 'sub'> | undefined;
  titleFor: (moduleId: string) => string;
  codeFor: (moduleId: string) => string;
  ectsOf: (moduleId: string) => number;
  /** The weights the fit was computed with, so the top reason matches it. */
  weights: Weights;
  /** False when the profile has nothing to score yet: no fit numbers are printed. */
  scored: boolean;
}

/**
 * The sub-score that contributes most to the printed fit, as its label: the plan's one-word "top reason". Each
 * score counts at the student's own weight, as the fit does, so a reason weighted to zero is never named.
 */
export function topReason(sub: Recommendation['sub'], weights: Weights): string | null {
  const [best] = (Object.keys(sub) as (keyof typeof sub)[])
    .flatMap((key) => {
      const score = sub[key];
      return score === null ? [] : [{ key, contribution: score * weights[key] }];
    })
    .filter((s) => s.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);
  return best ? SUB_SCORE_LABELS[best.key] : null;
}

export function PlanPrint({ view, shortlist, fitOf, titleFor, codeFor, ectsOf, weights, scored }: PlanPrintProps) {
  const core = new Set(view.coreModuleIds);
  const chosen = shortlist.filter((id) => !core.has(id));
  const { ects } = view;
  const total = ects.core + ects.elective + ects.iExplore;
  const printed = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return createPortal(
    <article className="print-plan text-[10pt] leading-snug text-[#111]">
      <header className="mb-3 flex items-baseline justify-between border-b border-[#999] pb-2">
        <h1 className="text-[16pt] font-semibold">My module plan</h1>
        <p className="text-[9pt] text-[#555]">ModuleMatch · {printed}</p>
      </header>
      <p className="mb-3 rounded border border-dashed border-[#999] px-2 py-1 text-[9pt]">
        <strong>Mock timetable.</strong> {PROVISIONAL_NOTE} Synthetic demo data, not a real enrolment.
      </p>

      <section className="mb-3">
        <h2 className="mb-1 text-[11pt] font-semibold">
          Modules · {ects.max === null ? total : `${total} of ${ects.max}`} ECTS ({ects.core} core, {ects.elective} electives, {ects.iExplore} I-Explore)
        </h2>
        <table className="w-full border-collapse text-left">
          <thead className="text-[9pt] text-[#555]">
            <tr>
              <th className="py-0.5 pr-2 font-medium">Module</th>
              <th className="py-0.5 pr-2 font-medium">ECTS</th>
              <th className="py-0.5 pr-2 font-medium">{scored ? 'Fit' : ''}</th>
              <th className="py-0.5 font-medium">{scored ? 'Top reason' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {view.coreModuleIds.map((id) => (
              <tr key={id} className="border-t border-[#ddd]">
                <td className="py-0.5 pr-2">
                  {codeFor(id)} {titleFor(id)}
                </td>
                <td className="py-0.5 pr-2">{ectsOf(id)}</td>
                <td className="py-0.5 pr-2" colSpan={2}>
                  Core, compulsory
                </td>
              </tr>
            ))}
            {chosen.map((id) => {
              const rec = fitOf(id);
              return (
                <tr key={id} className="border-t border-[#ddd]">
                  <td className="py-0.5 pr-2">
                    {codeFor(id)} {titleFor(id)}
                  </td>
                  <td className="py-0.5 pr-2">{ectsOf(id)}</td>
                  <td className="py-0.5 pr-2">{scored && rec ? rec.fit : ''}</td>
                  <td className="py-0.5">{scored && rec ? (topReason(rec.sub, weights) ?? '') : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-3 grid gap-0.5 text-[9.5pt]">
        <h2 className="text-[11pt] font-semibold">Checks</h2>
        <p>
          Programme rules:{' '}
          {ects.max === null
            ? 'not loaded for your year, so eligibility is not confirmed'
            : view.rules.violations.length === 0
              ? 'met'
              : view.rules.violations.map((v) => v.message).join(' ')}
        </p>
        {view.rules.warnings.map((w) => (
          <p key={w.code}>{w.message}</p>
        ))}
        <p>
          Clashes:{' '}
          {view.clashes.length === 0
            ? 'none'
            : view.clashes
                .map((c) => {
                  const first = c.overlaps[0]?.a;
                  const when = first ? `, ${DAY_NAMES[first.day]} ${termLabel(c.term).toLowerCase()}` : '';
                  return `${codeFor(c.moduleA)} and ${codeFor(c.moduleB)} (${CLASH_LABELS[c.label].toLowerCase()}${when})`;
                })
                .join('; ')}
        </p>
        {view.keepFreeConflicts.length > 0 && (
          <p>
            In kept-free time:{' '}
            {view.keepFreeConflicts
              .map(({ slot, window }) => `${codeFor(slot.moduleId)} ${DAY_NAMES[slot.day]} ${slot.start} (${keepFreeLabel(window)})`)
              .join('; ')}
          </p>
        )}
      </section>

      {view.grids.map((grid) => (
        <section key={grid.term} className="mb-2 break-inside-avoid">
          <h2 className="mb-1 text-[11pt] font-semibold">{termLabel(grid.term)} week</h2>
          <div className="grid grid-cols-5 gap-1">
            {byDay(grid.slots).map(({ day, name, slots }) => (
              <div key={day} className="rounded border border-[#ccc] p-1">
                <p className="mb-0.5 text-[9pt] font-semibold">{name}</p>
                {slots.map((s) => (
                  <p key={`${s.moduleId}-${s.sessionKey}-${s.start}`} className="mb-0.5 text-[8.5pt]">
                    <span className="font-medium">
                      {s.start}–{s.end}
                    </span>{' '}
                    {codeFor(s.moduleId)} {s.kind}
                    {core.has(s.moduleId) ? ' (core)' : ''}
                    {s.provisional ? ` · ${Math.round(s.probability * 100)}%` : ''}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </article>,
    document.body,
  );
}
