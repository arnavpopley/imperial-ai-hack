import { useCallback, useEffect, useRef, useState } from 'react';
import { toError } from '../lib/errors.ts';

export type ResourceState<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

interface Resource<T> {
  state: ResourceState<T>;
  /** Fetch again, showing the loading state. */
  reload: () => void;
  /** Replace the loaded data locally, for optimistic updates. No-op until the data has loaded. */
  update: (updater: (data: T) => T) => void;
}

/**
 * Loads `load()` once per `key` and exposes loading, error and ready states.
 * `load` is read through a ref, so callers can pass an inline closure without re-fetching each render.
 */
export function useResource<T>(key: string, load: () => Promise<T>): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  // Declared before the fetch effect so the latest closure is in place when a fetch starts.
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadRef.current().then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) => active && setState({ status: 'error', error: toError(error) }),
    );
    return () => {
      active = false;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const update = useCallback((updater: (data: T) => T) => {
    setState((prev) => (prev.status === 'ready' ? { status: 'ready', data: updater(prev.data) } : prev));
  }, []);

  return { state, reload, update };
}
