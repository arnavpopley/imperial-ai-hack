// Model calls for the Adaption scripts: the same structured-output request llm.ts makes, but with an explicit model and
// effort, so the stress test can compare Haiku 4.5 with Sonnet 5.5 and the relabelling can use Opus 5.5 and Fable 5.1.
// Every response's token usage is metered per model so each script can log and cap its spend.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { EXTRACTOR_SYSTEM, extractorMessage, grounded, keepValid, LiveOutput, stated, type ExtractedUpdate } from '../../server/src/agents/extractor.ts';

export type Effort = 'low' | 'medium' | 'high';

/** USD per million tokens (Anthropic first-party prices). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
};
/** Models that take effort and think adaptively; Haiku 4.5 takes neither. */
const THINKING = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1']);

export const spend: Record<string, { calls: number; input: number; output: number; usd: number }> = {};
export const totalSpend = () => Object.values(spend).reduce((n, s) => n + s.usd, 0);

function meter(model: string, usage: Anthropic.Beta.BetaUsage) {
  const p = PRICES[model] ?? PRICES['claude-fable-5-1']!;
  const s = (spend[model] ??= { calls: 0, input: 0, output: 0, usd: 0 });
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  s.calls++;
  s.input += usage.input_tokens + cacheRead + cacheWrite;
  s.output += usage.output_tokens;
  s.usd += (usage.input_tokens * p.input + usage.output_tokens * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1e6;
}

let client: Anthropic | null = null;

/** One structured call. Returns null on a refusal or a cut-off reply, like llm.ts `structured`. */
export async function callStructured<T extends z.ZodType>(
  schema: T,
  opts: { model: string; effort?: Effort; system: string; user: string; maxTokens?: number },
): Promise<z.infer<T> | null> {
  client ??= new Anthropic();
  const thinking = THINKING.has(opts.model);
  const response = await client.beta.messages.parse({
    model: opts.model,
    // Thinking counts towards max_tokens, so models that think get room for it.
    max_tokens: thinking ? Math.max(opts.maxTokens ?? 0, 16000) : (opts.maxTokens ?? 2048),
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: opts.user }],
    output_config: { ...(thinking ? { effort: opts.effort ?? 'low' } : {}), format: betaZodOutputFormat(schema) },
    ...(thinking ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  });
  meter(opts.model, response.usage);
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
  return response.parsed_output;
}

/** Our live extractor's prompt and post-processing on any model. Throws when the call fails, like `extract`. */
export async function extractWith(
  model: string,
  effort: Effort | undefined,
  text: string,
  targetSlots: string[],
  pathwayIds: string[],
  system = EXTRACTOR_SYSTEM,
): Promise<ExtractedUpdate[]> {
  if (!text.trim()) return [];
  const result = await callStructured(LiveOutput, { model, effort, system, user: extractorMessage(text, targetSlots, pathwayIds), maxTokens: 1500 });
  if (!result) throw new Error('no structured output');
  return keepValid(stated(text, grounded(text, result.updates), targetSlots), pathwayIds);
}

export function spendReport(): string {
  return Object.entries(spend)
    .map(([m, s]) => `${m}: ${s.calls} calls, ${s.input} in / ${s.output} out, $${s.usd.toFixed(3)}`)
    .join('; ');
}
