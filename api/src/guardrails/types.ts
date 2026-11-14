import type { Mode, Verdict } from '@modulematch/shared';
import type { Tracer } from '../trace/tracer.ts';

/** The result of one guardrail stage. `text` is the (possibly rewritten) text passed to the next stage. */
export interface StageResult {
  verdict: Verdict;
  text: string;
  /** Shown to the student when the stage changed something; null when it passed silently. */
  notice: string | null;
  /** One-line summary for the trace. Never contains the removed text itself. */
  detail: string;
}

export interface InputContext {
  mode: Mode;
  tracer: Tracer;
}

/** Splits text into sentences, keeping the terminator, so stages can remove a sentence cleanly. */
export function sentences(text: string): string[] {
  return text.match(/[^.!?\n]+[.!?]*\s*/g) ?? [];
}

export const anyMatch = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text));
