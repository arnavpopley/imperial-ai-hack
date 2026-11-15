// Issue #68: for a shortlisted option that the synthetic cohort's demand puts near or over capacity, a calm
// suggestion of a backup. The server picks it with the timetable swap checks (rules, clashes, kind, eligibility)
// and leaves out anything near capacity itself. Adding keeps both; a swap is applied only after the student
// confirms it (spec 10.6). Fit scores and ranking are never changed.
import type { CapacityBackup } from '@modulematch/shared';
import { useState } from 'react';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { FitScore } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { DemandChip } from '../catalogue/DemandChip.tsx';
import { useShortlist } from '../hooks/useShortlist.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';

interface CapacityBackupPanelProps {
  backups: readonly CapacityBackup[];
  titleFor: (moduleId: string) => string;
}

export function CapacityBackupPanel({ backups, titleFor }: CapacityBackupPanelProps) {
  if (backups.length === 0) return null;
  return (
    <section aria-labelledby="backup-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <h2 id="backup-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon name="lifebuoy" size={15} className="text-muted" />
        Keep a backup in mind
      </h2>
      <p className="mt-0.5 text-[12px] text-muted">
        From the synthetic cohort’s shortlists. Popular modules can run out of places; your fit scores are unchanged.
      </p>
      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
        {backups.map((backup) => (
          <BackupItem key={`${backup.replaceModuleId}-${backup.withModuleId}`} backup={backup} titleFor={titleFor} />
        ))}
      </ul>
    </section>
  );
}

function BackupItem({ backup, titleFor }: { backup: CapacityBackup; titleFor: (moduleId: string) => string }) {
  const shortlist = useShortlist();
  const signal = useReferenceData().demandById.get(backup.replaceModuleId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = titleFor(backup.replaceModuleId);
  const alternative = titleFor(backup.withModuleId);
  const pending = busy || shortlist.isPending(backup.replaceModuleId) || shortlist.isPending(backup.withModuleId);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  // toggle reports its own failure through shortlist.error rather than throwing.
  const add = () => run(() => shortlist.toggle(backup.withModuleId));
  const swap = () => run(() => shortlist.swap(backup.replaceModuleId, backup.withModuleId));

  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <p className="text-[13px] leading-snug">
        <span className="font-semibold">{pick}</span>
        {signal ? (
          <DemandChip signal={signal} className="mt-1 flex w-fit" />
        ) : (
          <span className="text-muted"> is {backup.status === 'over' ? 'oversubscribed' : 'nearly full'}.</span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <FitScore value={backup.fit} variant="compact" className="text-sm" />
        <p className="min-w-0 flex-1 text-[13px] leading-snug">
          Backup: <span className="font-medium">{alternative}</span>
          <span className={cx('ml-1 tabular-nums', backup.fitDelta > 0 ? 'text-fit-high' : 'text-muted')}>
            ({backup.fitDelta === 0 ? 'same fit' : `${backup.fitDelta > 0 ? '+' : ''}${backup.fitDelta} fit`})
          </span>
          {backup.keepFreeConflicts > 0 && (
            <span className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-mode-explain/10 px-1.5 text-[11px] font-medium text-mode-explain">
              <Icon name="moon" size={10} />
              Uses kept-free time
            </span>
          )}
        </p>
      </div>
      {!confirming && (
        <div className="mt-2 flex flex-wrap gap-2">
          {backup.canAdd && (
            <Button size="sm" variant="primary" icon="plus" busy={busy} disabled={pending} onClick={() => void add()}>
              Add as backup
            </Button>
          )}
          <Button size="sm" icon="swap" disabled={pending} onClick={() => setConfirming(true)}>
            Swap
          </Button>
        </div>
      )}
      {!backup.canAdd && !confirming && (
        <p className="mt-1.5 text-[12px] text-muted">It clashes with {pick} or would break a programme rule, so it can only replace it.</p>
      )}
      {confirming && (
        <div role="group" aria-label="Confirm swap" className="animate-rise mt-3 border-t border-line pt-3">
          <p className="text-[13px] font-medium">
            Swap {pick} for {alternative}?
          </p>
          <p className="text-[12px] text-muted">Your shortlist changes only when you confirm.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon="check" busy={busy} onClick={() => void swap()}>
              Confirm swap
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {(error ?? shortlist.error) && (
        <p role="alert" className="mt-2 text-[13px] text-fit-low">
          That did not go through: {error ?? shortlist.error}
        </p>
      )}
    </li>
  );
}
