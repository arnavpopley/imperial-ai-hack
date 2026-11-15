// The student's marks as calm chips: code, title and mark, plus the codes we could not match.
// Marks are never coloured red or green: they are facts about the student, not a verdict.
import type { ModuleResult } from '@modulematch/shared';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../../components/cx.ts';
import { useModuleTitle } from '../state/ReferenceDataProvider.tsx';

export function MarkChips({ results, className }: { results: readonly ModuleResult[]; className?: string }) {
  const moduleTitle = useModuleTitle();
  const reduce = useReducedMotion();
  const matched = results.filter((r) => r.matched);
  return (
    <ul className={cx('flex flex-wrap gap-2', className)} aria-label="Your marks">
      {matched.map((r, i) => {
        const title = r.title ?? moduleTitle(r.moduleId);
        return (
          <motion.li
            key={`${r.moduleId}-${r.code}`}
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i, 12) * 0.04, type: 'spring', stiffness: 420, damping: 26 }}
            className="flex max-w-full min-w-0 items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-3 text-[13px] shadow-soft ring-1 ring-line"
          >
            <span className="min-w-0 truncate">
              <span className="sr-only">{r.code}, </span>
              <span className="font-medium">{title}</span>
            </span>
            {r.questionMarks.length > 0 && (
              <span
                title={`Marks for ${r.questionMarks.length} questions`}
                className="shrink-0 rounded-full bg-mode-explain/10 px-1.5 py-0.5 text-[11px] font-semibold text-mode-explain"
              >
                <span aria-hidden="true">{r.questionMarks.length} Q</span>
                <span className="sr-only">, marks for {r.questionMarks.length} questions, </span>
              </span>
            )}
            <span className="grid h-6 min-w-9 shrink-0 place-items-center rounded-full bg-brand-soft px-2 text-[12px] font-semibold text-brand tabular-nums">
              {Math.round(r.mark)}
              <span className="sr-only"> percent</span>
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}

export function UnmatchedCodes({ codes, className }: { codes: readonly string[]; className?: string }) {
  if (codes.length === 0) return null;
  return (
    <div className={cx('grid gap-1.5', className)}>
      <p className="text-[12.5px] text-muted">Not in our catalogue, so kept but not used:</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Codes not in the catalogue">
        {codes.map((code) => (
          <li key={code} className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 font-mono text-[12px] text-muted">
            {code}
          </li>
        ))}
      </ul>
    </div>
  );
}
