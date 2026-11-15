// Issue #68: for a shortlisted option that the synthetic cohort's demand puts near or over capacity, a calm
// suggestion of a backup. The server picks it with the timetable swap checks (rules, clashes, kind, eligibility)
// and leaves out anything near capacity itself. Adding keeps both; a swap is applied only after the student
// confirms it (spec 10.6). Fit scores and ranking are never changed.
import { CAPACITY_LABELS, type CapacityBackup } from '@modulematch/shared';
import { useRef, useState } from 'react';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { FitScore } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { DemandChip } from '../catalogue/DemandChip.tsx';
import { useShortlist } from '../hooks/useShortlist.ts';
import { useCatalogue } from '../state/CatalogueProvider.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';

interface CapacityBackupPanelProps {
  backups: readonly CapacityBackup[];
  titleFor: (moduleId: string) => string;
}

type Shortlist = ReturnType<typeof useShortlist>;

/** Runs one row's change at a time, so two rows sharing a backup can never both swap it in. */
type RunOne = (key: string, action: () => Promise<void>) => Promise<void>;

const rowKey = (b: CapacityBackup) => `${b.replaceModuleId}-${b.withModuleId}`;

export function CapacityBackupPanel({ backups, titleFor }: CapacityBackupPanelProps) {
  const shortlist = useShortlist();
  const [active, setActive] = useState<string | null>(null);
  // A ref as well as state, so two clicks in the same tick cannot both pass the check.
  const lock = useRef(false);
  const runOne: RunOne = async (key, action) => {
    if (lock.current) return;
    lock.current = true;
    setActive(key);
    try {
      await action();
    } finally {
      lock.current = false;
      setActive(null);
    }
  };

  // The rows were worked out for the shortlist as it was when this timetable response arrived. Once the shortlist
  // changes, every row may be out of date (canAdd in particular), so all of them wait for the next response.
  const shortlistKey = shortlist.shortlist.join(',');
  const [received, setReceived] = useState({ backups, shortlistKey });
  if (received.backups !== backups) setReceived({ backups, shortlistKey });
  const stale = received.backups === backups && received.shortlistKey !== shortlistKey;

  // Rows the shortlist has already settled (the backup added, or the pick removed) are dropped at once.
  const live = backups.filter(
    (b) => shortlist.isShortlisted(b.replaceModuleId) && !shortlist.isShortlisted(b.withModuleId),
  );
  if (live.length === 0) return null;
  return (
    <section aria-labelledby="backup-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <h2 id="backup-heading" className="flex items-center gap-1.5 text-subheading">
        <Icon name="lifebuoy" size={15} className="text-muted" />
        Keep a backup in mind
      </h2>
      <p className="mt-0.5 text-2xs text-muted">
        From the synthetic cohort’s shortlists. Modules over or near capacity can run out of places; your fit scores are unchanged.
      </p>
      {stale && (
        <p role="status" className="mt-1 text-2xs text-muted">
          Checking these against your updated shortlist…
        </p>
      )}
      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
        {live.map((backup) => (
          <BackupItem
            key={rowKey(backup)}
            backup={backup}
            titleFor={titleFor}
            shortlist={shortlist}
            busy={active === rowKey(backup)}
            locked={active !== null || stale}
            runOne={runOne}
          />
        ))}
      </ul>
    </section>
  );
}

function BackupItem({
  backup,
  titleFor,
  shortlist,
  busy,
  locked,
  runOne,
}: {
  backup: CapacityBackup;
  titleFor: (moduleId: string) => string;
  shortlist: Shortlist;
  /** This row's change is in flight. */
  busy: boolean;
  /** Some row's change is in flight, so every row waits. */
  locked: boolean;
  runOne: RunOne;
}) {
  const signal = useReferenceData().demandById.get(backup.replaceModuleId);
  // Starter profiles have no fit signal yet (spec 8.6), so their fit numbers are not shown, as in the catalogue.
  const { scored } = useCatalogue();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = titleFor(backup.replaceModuleId);
  const alternative = titleFor(backup.withModuleId);
  const pending = locked || shortlist.isPending(backup.replaceModuleId) || shortlist.isPending(backup.withModuleId);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await runOne(rowKey(backup), action);
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  // toggle reports its own failure through shortlist.error rather than throwing. It only ever adds here: a backup
  // that is already shortlisted is filtered out above, and checked again in case a click lands mid-update.
  const add = () =>
    run(async () => {
      if (!shortlist.isShortlisted(backup.withModuleId)) await shortlist.toggle(backup.withModuleId);
    });
  const swap = () =>
    run(async () => {
      if (!shortlist.isShortlisted(backup.withModuleId)) await shortlist.swap(backup.replaceModuleId, backup.withModuleId);
    });

  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs leading-snug">
        <span className="font-semibold">{pick}</span>
        {signal ? (
          <DemandChip signal={signal} className="mt-1 flex w-fit" />
        ) : (
          <span className="text-muted"> is {CAPACITY_LABELS[backup.status].toLowerCase()}.</span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {scored && <FitScore value={backup.fit} variant="compact" className="text-sm" />}
        <p className="min-w-0 flex-1 text-xs leading-snug">
          Backup: <span className="font-medium">{alternative}</span>
          {scored && (
            <span className={cx('ml-1 tabular-nums', backup.fitDelta > 0 ? 'text-fit-high' : 'text-muted')}>
              ({backup.fitDelta === 0 ? 'same fit' : `${backup.fitDelta > 0 ? '+' : ''}${backup.fitDelta} fit`})
            </span>
          )}
          {backup.keepFreeConflicts > 0 && (
            <span className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-mode-explain/10 px-1.5 text-2xs font-medium text-mode-explain">
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
        <p className="mt-1.5 text-2xs text-muted">It clashes with {pick} or would break a programme rule, so it can only replace it.</p>
      )}
      {confirming && (
        <div role="group" aria-label="Confirm swap" className="animate-rise mt-3 border-t border-line pt-3">
          <p className="text-xs font-medium">
            Swap {pick} for {alternative}?
          </p>
          <p className="text-2xs text-muted">Your shortlist changes only when you confirm.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon="check" busy={busy} disabled={pending} onClick={() => void swap()}>
              Confirm swap
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {(error ?? shortlist.error) && (
        <p role="alert" className="mt-2 text-xs text-fit-low">
          That did not go through: {error ?? shortlist.error}
        </p>
      )}
    </li>
  );
}
