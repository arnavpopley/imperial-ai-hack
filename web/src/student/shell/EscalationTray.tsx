// Screen 7: the drafted escalation to approve, then each escalation's status and the staff reply. Issue 64 keeps it
// out of the way: the draft card shows only on the Catalogue and in the advisor (a chip elsewhere), and sent
// requests and replies open once, then fold to chips that open on tap; a reply's chip can be dismissed.
import type { Escalation } from '@modulematch/shared';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useMatch } from 'react-router';
import { EscalationCard, ESCALATION_QUEUE } from '../../components/EscalationCard.tsx';
import { draftIdentity } from '../../components/exceptions.ts';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { useEscalationDraft } from '../hooks/useEscalationDraft.ts';
import { paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { readEscalationTray, writeEscalationTray, type EscalationTrayMemory } from '../state/storage.ts';

interface EscalationTrayProps {
  /** all: the draft plus sent and answered escalations. draft: only the draft, for inside the chat. */
  scope?: 'all' | 'draft';
  /** Opens the advisor, where a draft can be reviewed from any page. */
  onReviewDraft?: () => void;
  className?: string;
}

const answered = (e: Escalation) => e.status === 'resolved' || Boolean(e.staffResponse);

/** What the student has seen of an escalation: sending it, then the reply, each shown once in full. */
const stage = (e: Escalation) => `${e.id}:${answered(e) ? 'reply' : 'sent'}`;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A chip's words, icon and tone for one escalation. A request about a module names it (issue 107), so two requests
 * to the Senior Tutor can be told apart; any other names the queue.
 */
function chipFor(e: Escalation, subject: string | null): { label: string; icon: IconName; tone: string } {
  const who = subject ?? capitalise(ESCALATION_QUEUE[e.type]);
  if (!answered(e)) return { label: `${who} · ${e.status === 'claimed' ? 'reading' : 'waiting'}`, icon: 'clock', tone: 'bg-surface-2 text-muted ring-line' };
  if (e.decision === 'declined') return { label: `${who} · declined`, icon: 'x', tone: 'bg-surface-2 text-ink ring-line' };
  if (e.decision === 'approved') return { label: `${who} · approved`, icon: 'check', tone: 'bg-fit-high/10 text-fit-high ring-fit-high/30' };
  return { label: `${who} · replied`, icon: 'check', tone: 'bg-fit-high/10 text-fit-high ring-fit-high/30' };
}

export function EscalationTray({ scope = 'all', onReviewDraft, className }: EscalationTrayProps) {
  const { session } = useReadySession();
  const { moduleById } = useReferenceData();
  const subjectOf = (e: Escalation) => {
    const id = e.request?.moduleId;
    return id ? (moduleById.get(id)?.title ?? id) : null;
  };
  const { draft, approve, discard, sending, error } = useEscalationDraft();
  const onCatalogue = useMatch(paths.catalogue) !== null;
  const [memory, setMemory] = useState<EscalationTrayMemory>(() => readEscalationTray(session.id));
  const [open, setOpen] = useState<string | null>(null);

  const sessionId = session.id;
  const remember = useCallback(
    (change: (current: EscalationTrayMemory) => EscalationTrayMemory) =>
      setMemory((current) => {
        const next = change(current);
        writeEscalationTray(sessionId, next);
        return next;
      }),
    [sessionId],
  );
  const markSeen = useCallback(
    (e: Escalation) => remember((m) => (m.seen.includes(stage(e)) ? m : { ...m, seen: [...m.seen, stage(e)] })),
    [remember],
  );
  const fold = (e: Escalation) => {
    setOpen(null);
    markSeen(e);
  };
  const dismiss = (e: Escalation) => {
    setOpen(null);
    remember((m) => ({ seen: m.seen.filter((s) => !s.startsWith(`${e.id}:`)), dismissed: [...m.dismissed, e.id] }));
  };

  const escalations =
    scope === 'all'
      ? [...session.escalations].filter((e) => !memory.dismissed.includes(e.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];
  // A request just sent, or a reply not yet read, opens by itself once, on the page where it arrives. Moving to
  // another page folds it to a chip, so no card stays pinned above every screen.
  const isFresh = (e: Escalation) => !memory.seen.includes(stage(e));
  // A new reply matters more than a confirmation that a request went out.
  const fresh = escalations.find((e) => isFresh(e) && answered(e)) ?? escalations.find(isFresh);
  const freshStage = fresh ? stage(fresh) : null;
  const { pathname } = useLocation();
  useEffect(() => setOpen(null), [pathname]);
  // Keyed on the newest unseen stage, so a reply to a request already seen as sent opens again. Every unseen stage
  // is marked at once, and the newest stays open.
  const unseen = escalations.filter((e) => !memory.seen.includes(stage(e))).map(stage);
  useEffect(() => {
    if (!fresh || !freshStage) return;
    setOpen(fresh.id);
    const stages = unseen;
    remember((m) => ({ ...m, seen: [...m.seen, ...stages.filter((s) => !m.seen.includes(s))] }));
  }, [freshStage]);
  const expanded = escalations.find((e) => e.id === open);
  const draftInFull = draft && (scope === 'draft' || onCatalogue);

  if (!draft && escalations.length === 0) return null;
  return (
    <div className={cx('grid gap-3', className)}>
      {draft && draftInFull && (
        <EscalationCard
          key={draftIdentity(draft)}
          variant="draft"
          escalationType={draft.type}
          summary={draft.summary}
          reason={draft.reason}
          onSend={(summary, reason) => void approve(summary, reason)}
          onDiscard={discard}
          sending={sending}
          error={error}
        />
      )}
      {(escalations.length > 0 || (draft && !draftInFull)) && (
        <ul className="flex flex-wrap gap-2" aria-label="Requests to staff">
          {draft && !draftInFull && (
            <li>
              <button
                type="button"
                onClick={onReviewDraft}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-mode-escalated/10 px-3 text-2xs font-semibold text-mode-escalated ring-1 ring-mode-escalated/30 ring-inset hover:bg-mode-escalated/15"
              >
                <Icon name="tutor" size={13} />
                Note to {ESCALATION_QUEUE[draft.type]} · review
              </button>
            </li>
          )}
          {escalations.map((e) => {
            const chip = chipFor(e, subjectOf(e));
            const isOpen = expanded?.id === e.id;
            return (
              <li key={e.id} className="flex items-center">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => (isOpen ? fold(e) : setOpen(e.id))}
                  className={cx(
                    'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-2xs font-semibold ring-1 ring-inset',
                    chip.tone,
                    answered(e) && 'rounded-r-none pr-2',
                  )}
                >
                  <Icon name={chip.icon} size={13} />
                  {chip.label}
                  <Icon name="chevron-down" size={12} className={cx('transition-transform', isOpen && 'rotate-180')} />
                </button>
                {answered(e) && (
                  <button
                    type="button"
                    onClick={() => dismiss(e)}
                    className={cx('grid h-8 w-7 place-items-center rounded-r-full ring-1 ring-inset', chip.tone)}
                  >
                    <Icon name="x" size={12} label={`Dismiss the reply from the ${ESCALATION_QUEUE[e.type]}`} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {expanded && (
        <div className="relative">
          {answered(expanded) ? (
            <EscalationCard
              key={expanded.id}
              variant="answered"
              escalationType={expanded.type}
              summary={expanded.summary}
              subject={subjectOf(expanded)}
              staffResponse={expanded.staffResponse ?? 'This was resolved without a written reply.'}
              createdAt={expanded.createdAt}
              decision={expanded.decision}
            />
          ) : (
            <EscalationCard
              key={expanded.id}
              variant="sent"
              escalationType={expanded.type}
              summary={expanded.summary}
              subject={subjectOf(expanded)}
              status={expanded.status === 'claimed' ? 'claimed' : 'open'}
              createdAt={expanded.createdAt}
            />
          )}
          <button
            type="button"
            onClick={() => fold(expanded)}
            className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="chevron-down" size={15} className="rotate-180" label="Fold to a chip" />
          </button>
        </div>
      )}
    </div>
  );
}
