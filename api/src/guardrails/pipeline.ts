// The input side of the guardrail pipeline (spec 11, G1 to G4). Classifier calls run in parallel to keep
// latency low, then verdicts are applied in stage order and every verdict is written to the trace.
import type { Verdict } from '@modulematch/shared';
import { scopeCheck } from './g1-scope.ts';
import { redaction } from './g2-redaction.ts';
import { injectionScan } from './g3-injection.ts';
import { wellbeingCheck } from './g4-wellbeing.ts';
import type { InputContext, StageResult } from './types.ts';

export interface GuardrailEvent {
  stage: string;
  verdict: Verdict;
  notice: string | null;
}

export interface InputOutcome {
  /** Redacted, injection-stripped text: the only version that may be stored or sent to other agents. */
  text: string;
  events: GuardrailEvent[];
  /** What the Supervisor does next: continue routing, redirect (G1), or switch to the wellbeing flow (G4). */
  action: 'continue' | 'redirect' | 'wellbeing';
}

/** Result of a stage that failed to run; treated as a pass so a classifier outage never blocks the student. */
const failed = (text: string, error: unknown): StageResult => ({
  verdict: 'pass',
  text,
  notice: null,
  detail: `classifier unavailable (${error instanceof Error ? error.name : 'error'}), pattern rules only`,
});

export async function runInputGuardrails(raw: string, ctx: InputContext): Promise<InputOutcome> {
  const timedStage = async (name: string, run: () => Promise<StageResult>, input: string) => {
    const started = performance.now();
    const result = await run().catch((error: unknown) => failed(input, error));
    return { name, result, latencyMs: Math.round(performance.now() - started) };
  };

  // G2 then G3 rewrite the text; G1 and G4 only classify it, so they run alongside on the raw input.
  const [g1, g4, rewritten] = await Promise.all([
    timedStage('G1 scope', () => scopeCheck(raw, ctx), raw),
    timedStage('G4 wellbeing', () => wellbeingCheck(raw, ctx), raw),
    (async () => {
      const g2 = await timedStage('G2 redaction', () => redaction(raw, ctx), raw);
      const g3 = await timedStage('G3 injection', () => injectionScan(g2.result.text, ctx), g2.result.text);
      return [g2, g3] as const;
    })(),
  ]);
  const ordered = [g1, rewritten[0], rewritten[1], g4];
  for (const { name, result, latencyMs } of ordered) {
    ctx.tracer.record({
      actor: name,
      kind: 'guardrail',
      input: `student turn (${raw.length} chars)`,
      output: result.detail,
      verdict: result.verdict,
      latencyMs,
    });
  }

  const action = g4.result.verdict === 'escalate' ? 'wellbeing' : g1.result.verdict === 'block' ? 'redirect' : 'continue';
  return {
    text: rewritten[1].result.text,
    events: ordered.map(({ name, result }) => ({ stage: name, verdict: result.verdict, notice: result.notice })),
    action,
  };
}
