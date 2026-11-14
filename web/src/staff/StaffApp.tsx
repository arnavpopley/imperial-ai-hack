// WS5 owns this directory. WS0 placeholder: renders fixture module demand.
import type { StaffModuleSummary } from '@modulematch/shared';
import { useEffect, useState } from 'react';
import { api } from '../api.ts';

export function StaffApp() {
  const [rows, setRows] = useState<StaffModuleSummary[]>([]);
  useEffect(() => void api.staff.modules().then(setRows), []);
  return (
    <ul className="grid gap-3">
      {rows.map((m) => (
        <li key={m.moduleId} className="rounded-card border border-line bg-surface p-4">
          {m.code} {m.title}: {m.shortlisted} shortlisted, average fit {m.averageFit}
        </li>
      ))}
    </ul>
  );
}
