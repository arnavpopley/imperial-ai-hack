// Trace events as the audience reads them: internal codes become words, and counts agree with their nouns (#115).
import { MODE_LABELS } from '@modulematch/shared';

/** Escalation types and session modes (with the mode chip's own labels), as the trace records them. */
const CODE_LABELS: Record<string, string> = {
  ...MODE_LABELS,
  RULE_EXCEPTION: 'Rule exception',
  LOW_CONFIDENCE: 'Low confidence',
  WELLBEING: 'Wellbeing',
  COMPLAINT: 'Complaint',
};

/** Replaces known upper-case codes with their labels and "->" with an arrow; anything else is left as it is. */
export function labelCodes(text: string): string {
  return text.replace(/\b[A-Z]{2,}(?:_[A-Z]+)*\b/g, (code) => CODE_LABELS[code] ?? code).replace(/\s*->\s*/g, ' → ');
}

/** The noun to follow a count: "safety check" for 1, "safety checks" otherwise. */
export const noun = (n: number, word: string) => (n === 1 ? word : `${word}s`);
