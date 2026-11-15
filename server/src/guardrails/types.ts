import type { Mode, Verdict } from '@modulematch/shared';
import type { Tracer } from '../trace/tracer.ts';

/** The result of one guardrail stage. `text` is the (possibly rewritten) text passed to the next stage. */
export interface StageResult {
  verdict: Verdict;
  text: string;
  /** Shown to the student when the stage changed something; null when it passed silently. */
  notice: string | null;
  /** One-line summary for the trace. Never contains the removed text itself. */
  detail: string;
}

export interface InputContext {
  mode: Mode;
  tracer: Tracer;
}

/**
 * Words whose full stop does not end a sentence ("e.g.", "Dr."), lowercased and without the final stop. Only
 * unambiguous ones: "No.", "C." (the language) and "1st." end sentences far more often than they abbreviate.
 */
const ABBREVIATIONS = new Set(['e.g', 'eg', 'i.e', 'ie', 'etc', 'approx', 'cf', 'vs', 'viz', 'dr', 'prof', 'mr', 'mrs', 'ms', 'fig', 'figs', 'eq', 'eqs', 'dept']);
/** These can end a sentence too, so they do when a capitalised word follows ("…and so on, etc. The module…"). */
const MAY_END = new Set(['etc', 'approx']);
const TITLES = new Set(['dr', 'prof', 'mr', 'mrs', 'ms']);

/** The word just before position `dot` (letters and inner stops, as in "e.g"), and the word before that. */
function wordsBefore(text: string, dot: number): { word: string; previous: string } {
  let start = dot;
  while (start > 0 && /[A-Za-z.]/.test(text[start - 1]!)) start -= 1;
  const word = text.slice(start, dot);
  const previous = /(\S+)\s+$/.exec(text.slice(Math.max(0, start - 40), start))?.[1] ?? '';
  return { word, previous };
}

/** True when the full stop at `dot` belongs to an abbreviation or an initial, not the end of a sentence. */
function abbreviationStop(text: string, dot: number, after: number): boolean {
  const { word, previous } = wordsBefore(text, dot);
  const lower = word.toLowerCase().replace(/^\./, '');
  const nextWord = /^\s*(\S)/.exec(text.slice(after))?.[1] ?? '';
  const capitalNext = /[A-Z]/.test(nextWord);
  if (ABBREVIATIONS.has(lower)) return !(MAY_END.has(lower) && capitalNext);
  // A single capital initial after a title or another initial ("Dr A. Jones", "J. R. Smith"), or before one. Not
  // after an ordinary word: "written in C. Then…" and "Vibrations A. This module…" end their sentences.
  if (/^[A-Z]$/.test(word) && capitalNext) {
    const prev = previous.replace(/[.,]$/, '').toLowerCase();
    return TITLES.has(prev) || /^[A-Z]\.$/.test(previous) || /^\s*[A-Z]\.(\s|$)/.test(text.slice(after));
  }
  return false;
}

/**
 * Splits text into sentences, keeping each terminator and the whitespace after it, so stages can remove a sentence
 * cleanly and joining the pieces gives the text back. A sentence ends at ".", "!" or "?" followed by whitespace or
 * the end, or at a line break. It does not end at an abbreviation ("e.g.", "i.e.", "Dr."), an initial, a decimal
 * point, or inside brackets, so no piece leaves a bracket open (issue #106).
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '(' || ch === '[') depth += 1;
    else if ((ch === ')' || ch === ']') && depth > 0) depth -= 1;
    const newline = ch === '\n';
    if (!newline && !/[.!?]/.test(ch)) continue;
    let end = i + 1;
    if (!newline) {
      // A run of terminators, then any closing quotes or brackets that belong to the sentence.
      while (end < text.length && /[.!?]/.test(text[end]!)) end += 1;
      while (end < text.length && /["'\u2019\u201d)\]]/.test(text[end]!)) {
        if ((text[end] === ')' || text[end] === ']') && depth > 0) depth -= 1;
        end += 1;
      }
      const boundary = end >= text.length || /\s/.test(text[end]!);
      if (!boundary || depth > 0 || (ch === '.' && end === i + 1 && abbreviationStop(text, i, end))) {
        i = end - 1;
        continue;
      }
    } else {
      // A line break closes the paragraph, and any bracket left open in it.
      depth = 0;
    }
    while (end < text.length && /\s/.test(text[end]!)) end += 1;
    out.push(text.slice(start, end));
    start = end;
    i = end - 1;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

export const anyMatch = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text));
