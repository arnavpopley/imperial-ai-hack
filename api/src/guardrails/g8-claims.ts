// G8 claims filter (spec 11 and 20.5): remove guarantees about grades, jobs or outcomes.
import { anyMatch, sentences } from './types.ts';

const CLAIMS: RegExp[] = [
  /\bguarantee(s|d)?\b/i,
  /\b(will|is going to) (definitely |certainly |surely )?(get|land|secure|earn) you\b/i,
  /\byou (will|'ll) (definitely |certainly |surely )?(get|achieve|pass|land|secure|ace|score)\b/i,
  /\b(100%|certain(ly)?|sure) (to )?(pass|get a (job|first|2:1)|be hired)\b/i,
  /\b(easy|guaranteed) (first|2:1|a\*?|top marks|marks)\b/i,
];

export function filterClaims(text: string): { text: string; removed: number } {
  const all = sentences(text);
  const kept = all.filter((s) => !anyMatch(CLAIMS, s));
  return { text: kept.join('').trim(), removed: all.length - kept.length };
}
