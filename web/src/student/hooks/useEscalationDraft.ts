import type { Escalation } from '@modulematch/shared';
import { useCallback, useState } from 'react';
import { api } from '../../api.ts';
import { errorMessage } from '../../components/StateViews.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

export function upsertEscalation(list: readonly Escalation[], next: Escalation): Escalation[] {
  return list.some((e) => e.id === next.id) ? list.map((e) => (e.id === next.id ? next : e)) : [...list, next];
}

/** The agent's drafted escalation and the student's approval of it (spec 11.1 flow). */
export function useEscalationDraft() {
  const { session, draft, dismissDraft, update, refresh } = useReadySession();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = session.id;
  const type = draft?.type;

  const approve = useCallback(
    async (summary: string) => {
      if (!type) return;
      setSending(true);
      setError(null);
      try {
        const created = await api.escalate(sessionId, { type, summary });
        update((s) => ({ ...s, escalationDraft: null, escalations: upsertEscalation(s.escalations, created) }));
        dismissDraft();
        // Pick up the server's mode change (ESCALATED). The local copy is already correct if this fails.
        await refresh().catch(() => undefined);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setSending(false);
      }
    },
    [type, sessionId, update, dismissDraft, refresh],
  );

  return { draft, approve, discard: dismissDraft, sending, error };
}
