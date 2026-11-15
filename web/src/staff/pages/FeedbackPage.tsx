// Student feedback on AI answers: totals, up and down by answer kind, and recent down-votes with their reasons.
// Every text was redacted (G2, G3) before it was stored, and no item names a student or session.
import type { FeedbackSummary, FeedbackTargetKind } from '@modulematch/shared';
import { api } from '../../api.ts';
import { CountUp } from '../../components/CountUp.tsx';
import { AlertIcon, CheckIcon, MessageIcon, ShieldIcon } from '../components/icons.tsx';
import { Panel, StatTile } from '../components/ui.tsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews.tsx';
import { useResource } from '../hooks/useResource.ts';
import { focusRing, formatRelative, humanise, percent, plural } from '../lib/format.ts';
import { useStaffData } from '../StaffData.tsx';

const KIND_LABEL: Record<FeedbackTargetKind, string> = {
  message: 'Advisor chat',
  'module-answer': 'Module Q&A',
  explanation: 'Explanations',
  summary: 'AI summaries',
};

export function FeedbackPage() {
  const { state, reload } = useResource('feedback', api.staff.feedback);

  return (
    <div className="grid grid-cols-1 gap-8">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Student feedback</h2>
          <a
            href={api.staff.feedbackExportUrl}
            download
            className={`inline-flex min-h-10 items-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-canvas ${focusRing}`}
          >
            Export JSONL
          </a>
        </div>
        <p className="max-w-2xl text-base text-muted">
          How students rate the AI's answers. Down-votes show what to fix in the prompts first.
        </p>
        <p className="flex max-w-2xl items-start gap-3 rounded-2xl bg-brand-soft/60 p-4 text-sm leading-relaxed ring-1 ring-brand/20">
          <ShieldIcon className="mt-0.5 size-5 text-brand" />
          <span>
            Comments, questions and answer excerpts are redacted before they are stored, and no item names a student
            or session. The export holds the same redacted text from synthetic sessions only.
          </span>
        </p>
      </header>
      {state.status === 'loading' && <LoadingState label="Loading student feedback" />}
      {state.status === 'error' && <ErrorState title="Could not load feedback" message={state.error.message} onRetry={reload} />}
      {state.status === 'ready' && <FeedbackView summary={state.data} />}
    </div>
  );
}

function FeedbackView({ summary }: { summary: FeedbackSummary }) {
  const { moduleTitle } = useStaffData();

  if (summary.total === 0)
    return (
      <EmptyState icon="chat" title="No feedback yet">
        Ratings appear here once students use the thumbs under an answer.
      </EmptyState>
    );

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Ratings" icon={<MessageIcon className="size-5" />} value={<CountUp value={summary.total} />} />
        <StatTile
          label="Helpful"
          icon={<CheckIcon className="size-5" />}
          tone="bg-fit-high/10 text-fit-high"
          value={<CountUp value={summary.up} />}
          hint={`${percent(summary.up / summary.total)} of ratings`}
        />
        <StatTile
          label="Not helpful"
          icon={<AlertIcon className="size-5" />}
          tone="bg-fit-low/10 text-fit-low"
          value={<CountUp value={summary.down} />}
          hint={`${percent(summary.down / summary.total)} of ratings`}
        />
      </dl>

      <Panel title="By answer type" description="Thumbs up and down for each place the AI answers.">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Ratings by answer type</caption>
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 font-medium">
                Answer type
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Helpful
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Not helpful
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.byKind.map((k) => (
              <tr key={k.kind} className="border-b border-line last:border-0">
                <th scope="row" className="py-2.5 font-medium">
                  {KIND_LABEL[k.kind]}
                </th>
                <td className="py-2.5 text-right tabular-nums">{k.up}</td>
                <td className="py-2.5 text-right tabular-nums">{k.down}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Recent down-votes"
        description={`The latest ${plural(summary.recentDown.length, 'answer')} students marked as not helpful.`}
      >
        {summary.recentDown.length === 0 ? (
          <p className="text-sm text-muted">No down-votes yet.</p>
        ) : (
          <ol className="grid gap-3">
            {summary.recentDown.map((d) => (
              <li key={d.id} className="grid gap-2 rounded-2xl bg-surface-2 p-4">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="rounded-full bg-fit-low/10 px-2.5 py-0.5 font-semibold text-fit-low">
                    {d.reason ? humanise(d.reason) : 'No reason given'}
                  </span>
                  <span className="font-medium text-ink">{KIND_LABEL[d.kind]}</span>
                  {d.moduleId && <span>{moduleTitle(d.moduleId)}</span>}
                  <time dateTime={d.createdAt}>{formatRelative(d.createdAt)}</time>
                </p>
                {d.comment && <p className="text-sm">&ldquo;{d.comment}&rdquo;</p>}
                {(d.question || d.answerExcerpt) && (
                  <dl className="grid gap-1 text-xs leading-relaxed text-muted">
                    {d.question && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium text-ink">Asked</dt>
                        <dd className="min-w-0 break-words">{d.question}</dd>
                      </div>
                    )}
                    {d.answerExcerpt && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium text-ink">Answer</dt>
                        <dd className="line-clamp-3 min-w-0 break-words">{d.answerExcerpt}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
