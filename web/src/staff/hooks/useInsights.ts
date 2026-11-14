import type { Insight, InsightDecision } from '@modulematch/shared';
import { useCallback, useState } from 'react';
import { api } from '../../api.ts';
import { errorMessage } from '../lib/errors.ts';
import { useResource } from './useResource.ts';

export type StaffDecision = Exclude<InsightDecision, 'pending'>;

/**
 * Insight cards for one module, with optimistic decisions (spec 10.7: every card waits for a staff decision).
 * A failed save restores the previous decision and records the error against that card.
 */
export function useInsights(moduleId: string) {
  const resource = useResource(`insights:${moduleId}`, () => api.staff.insights(moduleId));
  const { update } = resource;
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlyMap<string, string>>(new Map());

  const setDecision = useCallback(
    (id: string, decision: InsightDecision) =>
      update((list) => list.map((i) => (i.id === id ? { ...i, decision } : i))),
    [update],
  );

  const decide = useCallback(
    async (insight: Insight, decision: StaffDecision) => {
      const previous = insight.decision;
      setDecision(insight.id, decision);
      setSaving((s) => new Set(s).add(insight.id));
      setFailed((f) => {
        const next = new Map(f);
        next.delete(insight.id);
        return next;
      });
      try {
        const saved = await api.staff.decide(insight.id, { decision });
        setDecision(insight.id, saved.decision);
      } catch (e) {
        setDecision(insight.id, previous);
        setFailed((f) => new Map(f).set(insight.id, errorMessage(e)));
      } finally {
        setSaving((s) => {
          const next = new Set(s);
          next.delete(insight.id);
          return next;
        });
      }
    },
    [setDecision],
  );

  return { ...resource, decide, saving, failed };
}
