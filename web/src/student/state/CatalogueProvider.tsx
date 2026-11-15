// Ranked recommendations plus the what-if weights (spec 8.5). Sub-scores do not depend on the
// weights, so moving a slider re-ranks on the client with combineFit and saves after a pause.
import {
  combineFit,
  DEFAULT_WEIGHTS,
  type Module,
  type Recommendation,
  type RecommendationsResponse,
  type Weights,
} from '@modulematch/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../../api.ts';
import { useAsync, type AsyncResult } from '../hooks/useAsync.ts';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts';
import { useReferenceData } from './ReferenceDataProvider.tsx';
import { useReadySession } from './SessionProvider.tsx';

const SAVE_DELAY_MS = 500;

export type WeightKey = keyof Weights;
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface RankedModule extends Recommendation {
  module: Module | undefined;
  /** 1-based position at the current weights. */
  rank: number;
  /** Positions gained (positive) or lost against the default weights. */
  rankShift: number;
  /** A compulsory core module for this year: already in the student's plan, so not offered as an addition. */
  compulsory: boolean;
}

interface CatalogueValue {
  recs: AsyncResult<RecommendationsResponse>;
  weights: Weights;
  setWeight: (key: WeightKey, value: number) => void;
  resetWeights: () => void;
  isDefaultWeights: boolean;
  saveState: SaveState;
  /** Eligible modules first, each group ordered by live fit. */
  ranked: RankedModule[];
  byId: ReadonlyMap<string, RankedModule>;
}

const CatalogueContext = createContext<CatalogueValue | null>(null);

/** Eligible first (spec 8.7 keeps ineligible modules listed, greyed), then by fit, then by id for stability. */
function order(a: Recommendation & { fit: number }, b: Recommendation & { fit: number }): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  return b.fit - a.fit || a.moduleId.localeCompare(b.moduleId);
}

const sameWeights = (a: Weights, b: Weights) =>
  a.interest === b.interest && a.goal === b.goal && a.style === b.style && a.breadth === b.breadth;

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const { session, recsVersion } = useReadySession();
  const { moduleById } = useReferenceData();
  const sessionId = session.id;
  const recs = useAsync(() => api.recommendations(sessionId), [sessionId, recsVersion, session.profile.updatedAt]);
  const [weights, setWeights] = useState<Weights>(session.weights);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** Counts local slider edits, so a server refresh that started before an edit never overwrites it. */
  const editSeq = useRef(0);

  // A chat what-if changes the weights on the server and bumps recsVersion; adopt the server's weights then,
  // so the sliders and the client-side re-rank match what the advisor just said.
  useEffect(() => {
    if (recsVersion === 0) return;
    let live = true;
    const startedAt = editSeq.current;
    api.recommendations(sessionId).then(
      (response) => {
        if (live && editSeq.current === startedAt) setWeights(response.weights);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [recsVersion, sessionId]);
  const saveSeq = useRef(0);
  const { setData } = recs;

  const save = useDebouncedCallback((next: Weights) => {
    const seq = (saveSeq.current += 1);
    setSaveState('saving');
    api.setWeights(sessionId, next).then(
      (response) => {
        if (seq !== saveSeq.current) return;
        setData(response);
        setSaveState('saved');
      },
      () => {
        if (seq === saveSeq.current) setSaveState('error');
      },
    );
  }, SAVE_DELAY_MS);

  const setWeight = useCallback(
    (key: WeightKey, value: number) => {
      const next = { ...weights, [key]: value };
      editSeq.current += 1;
      setWeights(next);
      save(next);
    },
    [weights, save],
  );

  const resetWeights = useCallback(() => {
    editSeq.current += 1;
    setWeights(DEFAULT_WEIGHTS);
    save(DEFAULT_WEIGHTS);
  }, [save]);

  const ranked = useMemo(() => {
    const list = recs.data?.recommendations ?? [];
    const core = new Set(recs.data?.coreModuleIds ?? []);
    const baseline = list
      .map((r) => ({ ...r, fit: combineFit(r.sub, DEFAULT_WEIGHTS) }))
      .sort(order)
      .map((r) => r.moduleId);
    return list
      .map((r) => ({ ...r, fit: combineFit(r.sub, weights) }))
      .sort(order)
      .map(
        (r, index): RankedModule => ({
          ...r,
          module: moduleById.get(r.moduleId),
          rank: index + 1,
          rankShift: baseline.indexOf(r.moduleId) - index,
          compulsory: core.has(r.moduleId),
        }),
      );
  }, [recs.data, weights, moduleById]);

  const byId = useMemo(() => new Map(ranked.map((r) => [r.moduleId, r])), [ranked]);

  const value = useMemo<CatalogueValue>(
    () => ({
      recs,
      weights,
      setWeight,
      resetWeights,
      isDefaultWeights: sameWeights(weights, DEFAULT_WEIGHTS),
      saveState,
      ranked,
      byId,
    }),
    [recs, weights, setWeight, resetWeights, saveState, ranked, byId],
  );
  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue(): CatalogueValue {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return value;
}
