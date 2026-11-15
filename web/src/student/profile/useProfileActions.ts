import type { ProfileEditBody, SessionState } from '@modulematch/shared';
import { useCallback, useState } from 'react';
import { api } from '../../api.ts';
import { errorMessage } from '../../components/StateViews.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

/** Student edits to the profile (spec 13, PUT /profile), including confirming the interview card. */
export function useProfileActions() {
  const { session, replace, invalidateRecs } = useReadySession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = session.id;

  /** Resolves to the saved session, or null when the save failed (the error is then in `error`). */
  const save = useCallback(
    async (body: ProfileEditBody): Promise<SessionState | null> => {
      setSaving(true);
      setError(null);
      try {
        const saved = await api.editProfile(sessionId, body);
        replace(saved);
        invalidateRecs();
        return saved;
      } catch (err) {
        setError(errorMessage(err));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [sessionId, replace, invalidateRecs],
  );

  return { save, saving, error };
}
