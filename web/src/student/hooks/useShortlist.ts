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

  /**
   * Spec 10.6: a swap is applied only after the student confirms it. Throws so the caller can show the error.
   * The alternative is added before the old module is removed, so the shortlist never dips below two and the
   * session stays in PLAN (spec 12) instead of flapping to RECOMMEND and back.
   */
  const swap = useCallback(
    async (removeId: string, addId: string) => {
      mark([removeId, addId], true);
      try {
        replace(await api.shortlist(sessionId, { moduleId: addId, action: 'add' }));
        try {
          replace(await api.shortlist(sessionId, { moduleId: removeId, action: 'remove' }));
        } catch (err) {
          // The removal may have been saved even though its response was lost, so read the shortlist back
          // before undoing anything. Old module gone: the swap went through. Still there: take the
          // alternative off again. Unknown: leave both, which loses nothing, and report the failure.
          const saved = await api.getSession(sessionId).catch(() => null);
          if (saved && !saved.shortlist.includes(removeId)) {
            replace(saved);
            return;
          }
          if (saved?.shortlist.includes(addId)) {
            await api.shortlist(sessionId, { moduleId: addId, action: 'remove' }).then(replace, () => replace(saved));
          } else if (saved) replace(saved);
          throw err;
        }
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
