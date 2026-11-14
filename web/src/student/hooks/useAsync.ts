import { useCallback, useEffect, useMemo, useRef, useState, type DependencyList } from 'react';
import { errorMessage } from '../../components/StateViews.tsx';

export interface AsyncResult<T> {
  /** The latest successful value. Kept while a reload is in flight so screens do not flash. */
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
  /** Replace the value with a fresher one from another call, for example a mutation response. */
  setData: (value: T) => void;
}

/**
 * Runs `load` on mount and whenever `deps` change, ignoring results that arrive after a newer request.
 * Pass `enabled: false` to wait, for example until a session id is known.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList, enabled = true): AsyncResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setLoading(true);
    setError(null);
    loadRef.current().then(
      (value) => {
        if (!current) return;
        setData(value);
        setLoading(false);
      },
      (err: unknown) => {
        if (!current) return;
        setError(errorMessage(err));
        setLoading(false);
      },
    );
    return () => {
      current = false;
    };
    // The caller's deps decide when to reload; `load` is read through a ref so it is always current.
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => ({ data, error, loading, reload, setData }), [data, error, loading, reload]);
}
