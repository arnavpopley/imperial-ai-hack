import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a function that calls `fn` once calls stop for `delay` ms. A pending call is flushed on
 * unmount, so leaving a screen mid-debounce still saves.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number): (...args: A) => void {
  const fnRef = useRef(fn);
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<A | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  });

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    const args = pendingRef.current;
    pendingRef.current = null;
    if (args) fnRef.current(...args);
  }, []);

  useEffect(() => flush, [flush]);

  return useCallback(
    (...args: A) => {
      pendingRef.current = args;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, delay);
    },
    [delay, flush],
  );
}
