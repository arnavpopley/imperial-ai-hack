// The "Your results" interview step: whether it was offered or skipped in this session, kept in localStorage.
// Whether marks are actually stored comes from the server, never from here.
import { useCallback, useState } from 'react';

export type ResultsStepStatus = 'done' | 'skipped' | 'todo';

interface StepMemory {
  /** The panel opened by itself once; it never opens by itself again. */
  offered: boolean;
  skipped: boolean;
}

const key = (sessionId: string) => `modulematch.results-step.${sessionId}`;

export function readStepMemory(sessionId: string): StepMemory {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(key(sessionId)) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return { offered: false, skipped: false };
    return { offered: 'offered' in raw && raw.offered === true, skipped: 'skipped' in raw && raw.skipped === true };
  } catch {
    return { offered: false, skipped: false };
  }
}

function writeStepMemory(sessionId: string, memory: StepMemory): void {
  try {
    window.localStorage.setItem(key(sessionId), JSON.stringify(memory));
  } catch {
    // Storage is blocked: the step still works for this visit.
  }
}

export function resultsStepStatus(hasResults: boolean, memory: StepMemory): ResultsStepStatus {
  if (hasResults) return 'done';
  return memory.skipped ? 'skipped' : 'todo';
}

/** The step's memory plus setters that persist it. */
export function useResultsStepMemory(sessionId: string) {
  const [memory, setMemory] = useState(() => readStepMemory(sessionId));
  const update = useCallback(
    (patch: Partial<StepMemory>) => {
      setMemory((current) => {
        const next = { ...current, ...patch };
        writeStepMemory(sessionId, next);
        return next;
      });
    },
    [sessionId],
  );
  const markOffered = useCallback(() => update({ offered: true }), [update]);
  const skip = useCallback(() => update({ offered: true, skipped: true }), [update]);
  return { memory, markOffered, skip };
}
