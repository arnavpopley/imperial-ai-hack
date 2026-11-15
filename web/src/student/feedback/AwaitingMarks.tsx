// Issue #108: an examiner has published feedback for an exam the student has a mark for, but their mark sheet has
// no question marks matching the examiner's questions, so nothing can be tailored yet. Say so, and how to fix it.
import type { ExamAwaitingMarks } from '@modulematch/shared';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { OPEN_RESULTS_STATE, paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';

/** "Q1, Q2, Q3 and Q4", or a range when the ids are Q1 to Qn in order. */
export function questionList(ids: readonly string[]): string {
  if (ids.length === 0) return '';
  const consecutive = ids.length > 2 && ids.every((id, i) => id.toUpperCase() === `Q${i + 1}`);
  if (consecutive) return `${ids[0]} to ${ids.at(-1)}`;
  return ids.length === 1 ? ids[0]! : `${ids.slice(0, -1).join(', ')} and ${ids.at(-1)}`;
}

export function AwaitingMarks({ exams }: { exams: readonly ExamAwaitingMarks[] }) {
  const navigate = useNavigate();
  const { moduleById } = useReferenceData();
  if (exams.length === 0) return null;
  return (
    <section aria-label="Feedback waiting for your question marks" className="grid gap-2">
      {exams.map((exam) => {
        const title = moduleById.get(exam.moduleId)?.title ?? exam.moduleId;
        return (
          <div
            key={exam.moduleId}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-mode-explain/8 px-4 py-3 ring-1 ring-mode-explain/25"
          >
            <Icon name="sparkle" size={16} className="shrink-0 text-mode-explain" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{title} feedback is out.</span> Add your question marks
              {exam.questionIds.length > 0 && ` (${questionList(exam.questionIds)})`} to get it tailored.
            </p>
            <Button size="sm" icon="plus" onClick={() => navigate(paths.interview, { state: OPEN_RESULTS_STATE })}>
              Add question marks
            </Button>
          </div>
        );
      })}
    </section>
  );
}
