import type { ProfileEditBody } from '@modulematch/shared';
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

  /** Resolves true when saved, false when the save failed (the error is then in `error`). */
  const save = useCallback(
    async (body: ProfileEditBody): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        replace(await api.editProfile(sessionId, body));
        invalidateRecs();
        return true;
      } catch (err) {
        setError(errorMessage(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [sessionId, replace, invalidateRecs],
  );

  return { save, saving, error };
}
