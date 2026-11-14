// Data every staff screen shares: the module catalogue (titles, derived tags) and the live escalation queue.
// Held once in StaffApp so the queue keeps polling, and the sub-nav badge stays live, on every screen.
import type { Module } from '@modulematch/shared';
import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api.ts';
import { useEscalationQueue } from './hooks/useEscalationQueue.ts';
import type { EscalationQueue } from './hooks/useEscalationQueue.ts';
import { useResource } from './hooks/useResource.ts';
import type { ResourceState } from './hooks/useResource.ts';

interface StaffData {
  catalogue: ResourceState<Module[]>;
  reloadCatalogue: () => void;
  /** Swap in a module the server returned after an edit. */
  replaceModule: (module: Module) => void;
  /** "Title" when the catalogue knows the module, otherwise the raw id. */
  moduleTitle: (id: string) => string;
  moduleCode: (id: string) => string | null;
  queue: EscalationQueue;
}

const StaffDataContext = createContext<StaffData | null>(null);

export function StaffDataProvider({ children }: { children: ReactNode }) {
  const { state: catalogue, reload: reloadCatalogue, update } = useResource('catalogue', api.modules);
  const queue = useEscalationQueue();

  const byId = useMemo(
    () => new Map(catalogue.status === 'ready' ? catalogue.data.map((m) => [m.id, m]) : []),
    [catalogue],
  );

  const replaceModule = useCallback(
    (module: Module) => update((list) => list.map((m) => (m.id === module.id ? module : m))),
    [update],
  );

  const value = useMemo<StaffData>(
    () => ({
      catalogue,
      reloadCatalogue,
      replaceModule,
      moduleTitle: (id) => byId.get(id)?.title ?? id,
      moduleCode: (id) => byId.get(id)?.code ?? null,
      queue,
    }),
    [catalogue, reloadCatalogue, replaceModule, byId, queue],
  );

  return <StaffDataContext.Provider value={value}>{children}</StaffDataContext.Provider>;
}

export function useStaffData(): StaffData {
  const value = useContext(StaffDataContext);
  if (!value) throw new Error('useStaffData must be used inside StaffDataProvider');
  return value;
}
