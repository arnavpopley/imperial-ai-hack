// "Your data", results part (spec 23 and 20.3): the marks we hold, when consent was given, and a way to
// withdraw consent, which deletes every stored mark.
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Skeleton } from '../../components/StateViews.tsx';
import { OPEN_RESULTS_STATE, paths } from '../routes.ts';
import { errorStatus } from './files.ts';
import { MarkSheetIcon } from './icons.tsx';
import { MarkChips, UnmatchedCodes } from './MarkChips.tsx';
import { useResults } from './ResultsProvider.tsx';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ResultsDataSection() {
  const { results, hasResults, unmatched, withdraw } = useResults();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const data = results.data;
  const consentDate = formatDate(data?.consent.at ?? null);
  const updated = formatDate(data?.updatedAt ?? null);
  const questionMarks = (data?.results ?? []).reduce((n, r) => n + r.questionMarks.length, 0);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await withdraw();
      setConfirming(false);
      setWithdrawn(true);
    } catch {
      setError('Your marks could not be deleted just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg">
      <header className="flex flex-wrap items-start gap-4">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <MarkSheetIcon size={22} />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 className="text-lg font-semibold tracking-tight">Your results</h3>
          <p className="text-sm text-muted">
            {hasResults && consentDate
              ? `Shared with your consent on ${consentDate}. Used only for gentle notes and your exam feedback.`
              : 'Optional. Marks are only ever kept if you share them and tick the consent box, and you can delete them here.'}
          </p>
        </div>
      </header>

      {results.loading && !data ? (
        <div className="grid gap-2" role="status" aria-label="Loading your results">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ) : hasResults && data ? (
        <>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
            <li>
              <span className="font-semibold text-ink tabular-nums">{data.results.filter((r) => r.matched).length}</span> modules
            </li>
            {questionMarks > 0 && (
              <li>
                <span className="font-semibold text-ink tabular-nums">{questionMarks}</span> question marks
              </li>
            )}
            {updated && <li>Last updated {updated}</li>}
          </ul>
          <MarkChips results={data.results} />
          <UnmatchedCodes codes={unmatched} />

          {error && (
            <p role="alert" className="text-sm text-fit-low">
              {error}
            </p>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div
                key="confirm"
                role="group"
                aria-label="Confirm withdrawing consent"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-fit-low/5 p-4 ring-1 ring-fit-low/30"
              >
                <span className="font-medium">Delete every mark and any exam feedback made from them?</span>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Button variant="danger" icon="trash" busy={busy} onClick={() => void remove()}>
                    Yes, delete my marks
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                    Keep them
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button
                  variant="secondary"
                  icon="trash"
                  className="h-auto min-h-10 py-2 text-left whitespace-normal"
                  onClick={() => setConfirming(true)}
                >
                  Withdraw consent and delete my marks
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm" role={withdrawn ? 'status' : undefined}>
            <Icon name={withdrawn ? 'check' : 'info'} size={15} className={withdrawn ? 'text-fit-high' : 'text-muted'} />
            {withdrawn
              ? 'Consent withdrawn. Every mark has been deleted.'
              : errorStatus(results.error) === 404 || !results.error
                ? 'No marks shared.'
                : 'Your results could not be loaded just now.'}
          </p>
          <Button size="sm" icon="plus" onClick={() => navigate(paths.interview, { state: OPEN_RESULTS_STATE })}>
            Add your results
          </Button>
        </div>
      )}
    </div>
  );
}
