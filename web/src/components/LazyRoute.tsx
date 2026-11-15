// Route-level code splitting: a screen's code loads when its route is first opened, so a student's first visit
// downloads only the landing page and what it needs. Rarely used, heavy screens (the staff console, "How it works",
// the exam form editor) never reach a student's browser unless opened.
import { motion } from 'motion/react';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { LoadingState } from './StateViews.tsx';

/** Shown while a screen's code loads. It fades in after a short pause, so a fast load shows nothing at all. */
export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }}>
      <LoadingState label={label} />
    </motion.div>
  );
}

/** A lazily loaded screen in a route element: the surrounding layout (header, tabs, shell) stays put. */
export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

/**
 * React.lazy for a named export, keeping its props type: `lazyNamed(() => import('./X.tsx'), 'X')`. `preload()`
 * fetches the code ahead of time (the import is cached, so the later render does not fetch it again).
 */
// `any` is React's own bound for lazy components; the returned component keeps M[K]'s real props type.
export function lazyNamed<K extends string, M extends { [P in K]: ComponentType<any> }>(load: () => Promise<M>, name: K) {
  const component = lazy(async (): Promise<{ default: M[K] }> => ({ default: (await load())[name] }));
  return Object.assign(component, { preload: () => void load().catch(() => undefined) });
}

/** Runs `work` once the browser is idle after the first paint, so warming the next screens never delays it. */
export function whenIdle(work: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(work, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, 1500);
  return () => window.clearTimeout(id);
}
