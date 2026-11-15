// Screen 7: the drafted escalation to approve, then each escalation's status and the staff reply.
import { EscalationCard } from '../../components/EscalationCard.tsx';
import { cx } from '../../components/cx.ts';
import { useEscalationDraft } from '../hooks/useEscalationDraft.ts';
import { useReadySession } from '../state/SessionProvider.tsx';

interface EscalationTrayProps {
  /** all: the draft plus sent and answered escalations. draft: only the draft, for inside the chat. */
  scope?: 'all' | 'draft';
  className?: string;
}

export function EscalationTray({ scope = 'all', className }: EscalationTrayProps) {
  const { session } = useReadySession();
  const { draft, approve, discard, sending, error } = useEscalationDraft();
  const escalations =
    scope === 'all' ? [...session.escalations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

  if (!draft && escalations.length === 0) return null;
  return (
    <div className={cx('grid gap-3', className)}>
      {draft && (
        <EscalationCard
          key={draft.summary}
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
      {escalations.map((e) =>
        e.status === 'resolved' || e.staffResponse ? (
          <EscalationCard
            key={e.id}
            variant="answered"
            escalationType={e.type}
            summary={e.summary}
            staffResponse={e.staffResponse ?? 'This was resolved without a written reply.'}
            createdAt={e.createdAt}
            decision={e.decision}
          />
        ) : (
          <EscalationCard
            key={e.id}
            variant="sent"
            escalationType={e.type}
            summary={e.summary}
            status={e.status}
            createdAt={e.createdAt}
          />
        ),
      )}
    </div>
  );
}
