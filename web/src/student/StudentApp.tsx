// WS4 owns this directory. WS0 placeholder: renders the fixture catalogue to prove the contract end to end.
import type { Module, RecommendationsResponse } from '@modulematch/shared';
import { useEffect, useState } from 'react';
import { api } from '../api.ts';

export function StudentApp() {
  const [modules, setModules] = useState<Module[]>([]);
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null);
  useEffect(() => {
    void api.modules().then(setModules);
    void api.recommendations('fixture-session').then(setRecs);
  }, []);
  const title = (id: string) => modules.find((m) => m.id === id)?.title ?? id;
  return (
    <ul className="grid gap-3">
      {recs?.recommendations.map((r) => (
        <li key={r.moduleId} className="rounded-card border border-line bg-surface p-4">
          <span className="font-semibold">{r.fit}</span> {title(r.moduleId)}
        </li>
      ))}
    </ul>
  );
}
