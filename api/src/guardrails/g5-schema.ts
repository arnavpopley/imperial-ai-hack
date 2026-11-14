// G5 schema validation (spec 11): validate agent output with zod, retry once, then fall back to a safe template.
import type { z } from 'zod';
import type { Tracer } from '../trace/tracer.ts';

export async function validated<T extends z.ZodType>(
  schema: T,
  attempt: () => Promise<unknown>,
  fallback: () => z.infer<T>,
  tracer: Tracer,
  what: string,
): Promise<z.infer<T>> {
  for (let tries = 1; tries <= 2; tries++) {
    const parsed = schema.safeParse(await attempt().catch(() => null));
    if (parsed.success) {
      tracer.record({ actor: 'G5 schema', kind: 'guardrail', input: what, output: `valid on try ${tries}`, verdict: 'pass' });
      return parsed.data;
    }
  }
  tracer.record({ actor: 'G5 schema', kind: 'guardrail', input: what, output: 'invalid twice, safe template used', verdict: 'block' });
  return fallback();
}
