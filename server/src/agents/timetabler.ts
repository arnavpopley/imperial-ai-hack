// Timetabler (spec 10.6): words only. Clashes and swaps come from the timetable engine, and a swap is
// applied only when the student confirms it.
import type { Clash, SwapSuggestion } from '@modulematch/shared';
import { asData, emitWords, isLive, streamText } from './llm.ts';

const LABEL: Record<Clash['label'], string> = { certain: 'a certain clash', likely: 'a likely clash', possible: 'a possible clash' };

export function describeTimetable(
  clashes: Clash[],
  swaps: SwapSuggestion[],
  title: (moduleId: string) => string,
): string {
  if (clashes.length === 0) return 'Your shortlist fits together with no clashes. Open the timetable to see your week.';
  const lines = clashes.slice(0, 3).map((c) => {
    const pct = Math.round(c.probability * 100);
    const odds = c.label === 'certain' ? '' : ` (${pct}% chance, the slots are still provisional)`;
    return `${title(c.moduleA)} and ${title(c.moduleB)} have ${LABEL[c.label]} in ${c.term}${odds}.`;
  });
  const swap = swaps[0];
  const offer = swap
    ? ` You could swap ${title(swap.replaceModuleId)} for ${title(swap.withModuleId)} (fit ${swap.fit}, ${swap.fitDelta >= 0 ? '+' : ''}${swap.fitDelta}). I will only make the swap if you confirm it on the timetable.`
    : ' I could not find a swap that keeps your fit within 10 points, so you may want to ask a tutor.';
  return `${lines.join(' ')}${offer}`;
}

const SYSTEM = `You are the timetabling assistant for a module advisor. Rewrite the given clash summary as a short, clear chat
message (under 70 words). Keep every module name, number and percentage exactly as given, invent nothing, and make clear
that a swap only happens if the student confirms it. Reply with only the message.`;

export async function explainTimetable(summary: string, onToken: (text: string) => void): Promise<string> {
  const text = isLive()
    ? await streamText({ tier: 'light', system: SYSTEM, messages: [{ role: 'user', content: asData('clash-summary', summary) }], maxTokens: 300 }, () => {}).catch(() => summary)
    : summary;
  emitWords(text, onToken);
  return text;
}
