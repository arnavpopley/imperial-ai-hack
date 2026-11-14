// G2 redaction then G3 injection stripping for free text that is stored but is not a chat turn, such as answer
// feedback comments and answer excerpts (spec 11 and 20). G2 runs its pattern pass and then, when live, the model
// pass; G3 the same. A stage that fails falls back to its pattern pass, so a failure never keeps text a rule removes.
import { redactByPattern, redaction } from './g2-redaction.ts';
import { injectionScan, stripInjection } from './g3-injection.ts';
import type { InputContext, StageResult } from './types.ts';

export interface CleanedText {
  /** The only version of the text that may be stored. */
  text: string;
  /** G2 or G3 removed something. */
  changed: boolean;
}

const fallback = (text: string, rewrite: (t: string) => string): StageResult => {
  const cleaned = rewrite(text);
  return { verdict: cleaned === text ? 'pass' : 'redact', text: cleaned, notice: null, detail: 'stage failed, pattern rules only' };
};

export async function cleanForStorage(text: string, ctx: InputContext): Promise<CleanedText> {
  if (!text.trim()) return { text: '', changed: false };
  const g2 = await redaction(text, ctx).catch(() => fallback(text, (t) => redactByPattern(t).text));
  const g3 = await injectionScan(g2.text, ctx).catch(() => fallback(g2.text, (t) => stripInjection(t).text));
  return { text: g3.text.trim(), changed: g2.verdict !== 'pass' || g3.verdict !== 'pass' };
}
