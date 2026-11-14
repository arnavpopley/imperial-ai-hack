// G6 grounding check (spec 11): every cited evidence ID and module field must exist. Unsupported reasons are
// dropped, and the explanation is blocked when none remain.
import type { Evidence, Explanation, Module } from '@modulematch/shared';

/** Resolves a dotted module field such as `topics.fluid-mechanics` or `demand.examShare`. */
export function moduleFieldExists(module: Module, field: string): boolean {
  const [head, ...rest] = field.split('.');
  if (!head || !Object.hasOwn(module, head)) return false;
  let value: unknown = module[head as keyof Module];
  for (const key of rest) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return false;
    value = (value as Record<string, unknown>)[key];
  }
  return value !== undefined && value !== null;
}

export function groundExplanation(
  explanation: Explanation,
  module: Module,
  evidence: Evidence[],
): { explanation: Explanation | null; dropped: number } {
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const because = explanation.because.filter((reason) => {
    const evidenceOk = reason.evidenceId === undefined || evidenceIds.has(reason.evidenceId);
    const fieldOk = reason.moduleField === undefined || moduleFieldExists(module, reason.moduleField);
    const cited = reason.evidenceId !== undefined || reason.moduleField !== undefined;
    return cited && evidenceOk && fieldOk;
  });
  const dropped = explanation.because.length - because.length;
  return { explanation: because.length > 0 ? { ...explanation, because } : null, dropped };
}
