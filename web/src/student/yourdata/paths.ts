// The "Your data" page route and the navigation state onboarding reads after a deletion.

export const yourDataPath = '/your-data';

/** Navigation state that tells onboarding to confirm the deletion. */
export const DELETED_STATE = { profileDeleted: true } as const;

export function wasProfileDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'profileDeleted' in state && state.profileDeleted === true;
}
