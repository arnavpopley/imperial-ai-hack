// Catalogue data that does not depend on the session: modules and pathways, loaded once.
import type { Module, Pathway } from '@modulematch/shared';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api } from '../../api.ts';
import { useAsync, type AsyncResult } from '../hooks/useAsync.ts';

interface ReferenceData {
  modules: AsyncResult<Module[]>;
  pathways: AsyncResult<Pathway[]>;
  moduleById: ReadonlyMap<string, Module>;
  pathwayById: ReadonlyMap<string, Pathway>;
}

const ReferenceDataContext = createContext<ReferenceData | null>(null);

export function ReferenceDataProvider({ children }: { children: ReactNode }) {
  const modules = useAsync(api.modules, []);
  const pathways = useAsync(api.pathways, []);
  const moduleById = useMemo(() => new Map((modules.data ?? []).map((m) => [m.id, m])), [modules.data]);
  const pathwayById = useMemo(() => new Map((pathways.data ?? []).map((p) => [p.id, p])), [pathways.data]);
  const value = useMemo(
    () => ({ modules, pathways, moduleById, pathwayById }),
    [modules, pathways, moduleById, pathwayById],
  );
  return <ReferenceDataContext.Provider value={value}>{children}</ReferenceDataContext.Provider>;
}

export function useReferenceData(): ReferenceData {
  const value = useContext(ReferenceDataContext);
  if (!value) throw new Error('useReferenceData must be used inside ReferenceDataProvider');
  return value;
}

/** A module's title, falling back to its id while the catalogue loads or when it is unknown. */
export function useModuleTitle(): (moduleId: string) => string {
  const { moduleById } = useReferenceData();
  return (moduleId) => moduleById.get(moduleId)?.title ?? moduleId;
}
