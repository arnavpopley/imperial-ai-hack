// Timetabler (spec 10.6): words only. Clashes and swaps come from the timetable engine, and a swap is
// applied only when the student confirms it.
import { SWAP_FIT_TOLERANCE, type Clash, type SwapSuggestion } from '@modulematch/shared';
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
  // Offer a swap that keeps the student's kept-free time free when any does, across every clash.
  const swap = swaps.find((s) => s.keepFreeConflicts === 0) ?? swaps[0];
  const keepFree = swap && swap.keepFreeConflicts > 0
    ? ` No swap keeps all your kept-free time free; this one has ${swap.keepFreeConflicts} session${swap.keepFreeConflicts > 1 ? 's' : ''} in it.`
    : '';
  const offer = swap
    ? ` You could swap ${title(swap.replaceModuleId)} for ${title(swap.withModuleId)} (fit ${swap.fit}, ${swap.fitDelta >= 0 ? '+' : ''}${swap.fitDelta}).${keepFree} I will only make the swap if you confirm it on the timetable.`
    : ` I could not find a swap that keeps your fit within ${SWAP_FIT_TOLERANCE} points, so you may want to ask a tutor.`;
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
