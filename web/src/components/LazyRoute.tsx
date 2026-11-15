// Route-level code splitting: a screen's code loads when its route is first opened, so a student's first visit
// downloads only the landing page and what it needs. Rarely used, heavy screens (the staff console, "How it works",
// the exam form editor) never reach a student's browser unless opened.
import { motion } from 'motion/react';
import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ErrorState, LoadingState } from './StateViews.tsx';

/** Shown while a screen's code loads. It fades in after a short pause, so a fast load shows nothing at all. */
export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }}>
      <LoadingState label={label} />
    </motion.div>
  );
}

interface BoundaryProps {
  /** Changing it (the route) clears the error, so navigating elsewhere shows that screen. */
  resetKey: string;
  children: ReactNode;
}

/**
 * Catches a screen whose code failed to download (offline, or a new deployment replaced the file) so only that
 * screen shows the error, never the whole app. React.lazy keeps a failed import, so "Try again" reloads the page,
 * which fetches the current files.
 */
export class ScreenErrorBoundary extends Component<BoundaryProps, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<{ failed: boolean }> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: { failed: boolean; resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('A screen failed to load:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorState
        title="This page did not load"
        message="Check your connection and try again. Everything you have saved is kept."
        onRetry={() => window.location.reload()}
      />
    );
  }
}

/**
 * A lazily loaded screen in a route element: the surrounding layout (header, tabs, shell) stays put while it
 * loads, and a failed download shows a recoverable error in its place.
 */
export function Lazy({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ScreenErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </ScreenErrorBoundary>
  );
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
