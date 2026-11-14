import { useCallback, useState } from 'react';
import { api } from '../../api.ts';
import { errorMessage } from '../../components/StateViews.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

/** Shortlist membership and mutations. The server's session response is the source of truth. */
export function useShortlist() {
  const { session, replace } = useReadySession();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const sessionId = session.id;
  const shortlist = session.shortlist;

  const mark = (ids: readonly string[], on: boolean) =>
    setPending((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const toggle = useCallback(
    async (moduleId: string) => {
      mark([moduleId], true);
      setError(null);
      try {
        const action = shortlist.includes(moduleId) ? 'remove' : 'add';
        replace(await api.shortlist(sessionId, { moduleId, action }));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        mark([moduleId], false);
      }
    },
    [sessionId, shortlist, replace],
  );

  /** Spec 10.6: a swap is applied only after the student confirms it. Throws so the caller can show the error. */
  const swap = useCallback(
    async (removeId: string, addId: string) => {
      mark([removeId, addId], true);
      try {
        await api.shortlist(sessionId, { moduleId: removeId, action: 'remove' });
        replace(await api.shortlist(sessionId, { moduleId: addId, action: 'add' }));
      } finally {
        mark([removeId, addId], false);
      }
    },
    [sessionId, replace],
  );

  return {
    shortlist,
    isShortlisted: (moduleId: string) => shortlist.includes(moduleId),
    isPending: (moduleId: string) => pending.has(moduleId),
    toggle,
    swap,
    error,
  };
}
