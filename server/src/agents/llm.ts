// Thin wrapper over the Anthropic SDK shared by every agent (spec 5 and 10).
// Model IDs come from the environment. With no credentials the app runs in offline mode: each agent
// falls back to its deterministic path, so the demo and the tests never depend on network access.
import { appendFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';

/**
 * When MODULEMATCH_USAGE_LOG names a file, each API call appends its model and token usage there as a JSON
 * line, so a live run (npm run e2e -- --live) can report what it spent. Off unless set.
 */
export function logUsage(model: string, usage: Anthropic.Beta.BetaUsage | undefined): void {
  const file = process.env.MODULEMATCH_USAGE_LOG;
  if (!file || !usage) return;
  try {
    appendFileSync(file, `${JSON.stringify({ model, ...usage })}\n`);
  } catch {
    // Usage logging must never break a reply.
  }
}

export type ModelTier = 'smart' | 'fast' | 'light';

const MODEL_ENV: Record<ModelTier, string> = { smart: 'MODEL_SMART', fast: 'MODEL_FAST', light: 'MODEL_LIGHT' };
// Opus 5.5 for what the student reads (questions, explanations, answers). Sonnet 5.5 at low effort where quality
// matters but speed does too (profile extraction, finding sensitive spans). Haiku 4.5 for simple yes/no
// classification and short wording, where it is accurate enough and much cheaper.
const MODEL_DEFAULT: Record<ModelTier, string> = { smart: 'claude-opus-5-5', fast: 'claude-sonnet-5-5', light: 'claude-haiku-4-5' };

export function modelId(tier: ModelTier): string {
  return process.env[MODEL_ENV[tier]] || MODEL_DEFAULT[tier];
}

/** Live when an API key is configured and MODULEMATCH_OFFLINE is not set (tests and evals set it). */
export function isLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MODULEMATCH_OFFLINE !== '1';
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type ChatMessage = Anthropic.Beta.BetaMessageParam;

export type Effort = 'low' | 'medium' | 'high';

interface CallOptions {
  tier: ModelTier;
  /** Stable instructions. Cached, so keep volatile content out of it. */
  system: string;
  messages: ChatMessage[];
  /** Output cap. Models that always think get at least THINKING_MIN_TOKENS whatever is asked for here. */
  maxTokens?: number;
  /** Thinking effort, for models that take one. Defaults to medium on the smart tier and low on the fast tier. */
  effort?: Effort;
  /** Overrides the tier's model, for example the eval judge. */
  model?: string;
}

/**
 * Current Opus, Sonnet and Fable models always think before answering, and thinking counts towards max_tokens.
 * A small cap can be used up by thinking alone, which cuts the visible reply off, so they never go below this.
 */
const THINKING_MIN_TOKENS = 8000;

/** Haiku neither always thinks nor accepts an effort setting; every other current model does both. */
const isHaiku = (model: string) => model.startsWith('claude-haiku');

/** Models that accept server-side refusal fallbacks routed by category (`fallbacks: 'default'`). */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

/** Request fields shared by every call: model, cached system prompt, effort, and refusal fallbacks. */
function baseParams(opts: CallOptions, defaultMaxTokens: number) {
  const model = opts.model ?? modelId(opts.tier);
  const fallback = FALLBACK_MODELS.has(model);
  return {
    model,
    max_tokens: isHaiku(model) ? (opts.maxTokens ?? defaultMaxTokens) : Math.max(opts.maxTokens ?? 0, THINKING_MIN_TOKENS),
    system: [{ type: 'text' as const, text: opts.system, cache_control: { type: 'ephemeral' as const } }],
    messages: opts.messages,
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

/** Effort for models that take one: medium by default on the smart tier, low on the fast tier for speed. */
function effort(opts: CallOptions): { effort?: Effort } {
  const model = opts.model ?? modelId(opts.tier);
  if (isHaiku(model)) return {};
  return { effort: opts.effort ?? (opts.tier === 'smart' ? 'medium' : 'low') };
}

/** A reply that stopped early (token cap or refusal) is incomplete, and callers fall back rather than show it. */
export class IncompleteReplyError extends Error {
  constructor(readonly stopReason: string | null) {
    super(`model reply incomplete (${stopReason ?? 'no stop reason'})`);
    this.name = 'IncompleteReplyError';
  }
}

/** Streams plain text, calling onToken for each delta, and resolves with the full text. */
export async function streamText(opts: CallOptions, onToken: (text: string) => void): Promise<string> {
  const stream = anthropic().beta.messages.stream({ ...baseParams(opts, 1024), output_config: effort(opts) });
  stream.on('text', onToken);
  const message = await stream.finalMessage();
  logUsage(message.model, message.usage);
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  if (message.stop_reason === 'max_tokens' || message.stop_reason === 'refusal' || !text.trim()) {
    throw new IncompleteReplyError(message.stop_reason);
  }
  return text;
}

/**
 * One structured-output call validated against a zod schema (spec 10: structured output validated by zod).
 * Returns null when the model refuses or the output does not parse, so callers can retry or fall back (G5).
 */
export async function structured<T extends z.ZodType>(
  schema: T,
  opts: CallOptions,
): Promise<z.infer<T> | null> {
  const response = await anthropic().beta.messages.parse({
    ...baseParams(opts, 2048),
    output_config: { ...effort(opts), format: betaZodOutputFormat(schema) },
  });
  logUsage(response.model, response.usage);
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
  return response.parsed_output;
}

/** Wraps untrusted text so prompts treat it as data, never instructions (spec 10). */
export function asData(label: string, text: string): string {
  const safe = text.replaceAll('</data>', '</ data>');
  return `<data source="${label}">\n${safe}\n</data>`;
}

/** Emits buffered text word by word so the client receives the same token events as a live stream. */
export function emitWords(text: string, onToken: (text: string) => void): void {
  for (const word of text.split(/(?<= )/)) onToken(word);
}
