// Trace writer (spec 11 and 12): every mode change, agent call, tool call and guardrail verdict becomes a
// TraceEvent. Inputs and outputs are short summaries, never raw sensitive text.
import type { TraceEvent } from '@modulematch/shared';
import { randomUUID } from 'node:crypto';

export type TraceInput = Omit<TraceEvent, 'id' | 'sessionId' | 'at' | 'latencyMs'> & { latencyMs?: number };
export type TraceSink = (event: TraceEvent) => void;

export interface Tracer {
  record(event: TraceInput): TraceEvent;
  /** Runs fn, records its latency, and lets `describe` summarise the result for the trace. */
  timed<T>(event: Omit<TraceInput, 'output' | 'verdict'>, fn: () => Promise<T>, describe: (r: T) => Pick<TraceEvent, 'output' | 'verdict'>): Promise<T>;
}

/** Trims a summary for the trace so no long free text ever lands there. */
export const summarise = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function createTracer(sessionId: string, sink: TraceSink): Tracer {
  const record = (event: TraceInput): TraceEvent => {
    const full: TraceEvent = {
      id: randomUUID(),
      sessionId,
      at: new Date().toISOString(),
      latencyMs: 0,
      ...event,
      input: summarise(event.input),
      output: summarise(event.output),
    };
    sink(full);
    return full;
  };
  return {
    record,
    async timed(event, fn, describe) {
      const started = performance.now();
      const result = await fn();
      record({ ...event, ...describe(result), latencyMs: Math.round(performance.now() - started) });
      return result;
    },
  };
}
