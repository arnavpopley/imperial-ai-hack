// WS6 owns this directory. WS0 placeholder: renders the fixture trace.
import type { TraceEvent } from '@modulematch/shared';
import { useEffect, useState } from 'react';
import { api } from '../api.ts';

export function TraceApp() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  useEffect(() => void api.trace('fixture-session').then(setEvents), []);
  return (
    <ol className="grid gap-2 font-mono text-sm">
      {events.map((e) => (
        <li key={e.id}>
          {e.actor} [{e.kind}] {e.output} {e.verdict ?? ''}
        </li>
      ))}
    </ol>
  );
}
