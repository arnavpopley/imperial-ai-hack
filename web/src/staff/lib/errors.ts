export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

export const errorMessage = (e: unknown): string => toError(e).message;
