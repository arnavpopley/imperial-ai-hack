// Transcript parser (spec 23): turns pasted transcript or mark-sheet text into module results, deterministically.
// It reads lines such as "MECH50010 Fluid Mechanics 2 62", "62%", tab- or comma-separated rows, title-only rows,
// and question breakdowns such as "Q1 14/20" (on the module's line or on the lines after it). Codes and titles are
// matched to the catalogue; codes that match nothing are kept as unmatched results and listed separately.
import type { Module, ModuleResult } from '@modulematch/shared';

type CatalogueEntry = Pick<Module, 'id' | 'code' | 'title'>;
type QuestionMark = ModuleResult['questionMarks'][number];

/** A row read from a transcript, before it is matched to the catalogue (the parser and the live reader both produce these). */
export interface TranscriptRow {
  code: string | null;
  title: string | null;
  mark: number | null;
  questionMarks: QuestionMark[];
}

export interface ParsedTranscript {
  results: ModuleResult[];
  /** Codes that match no catalogue module (kept as unmatched results, never used for nudges). */
  unmatched: string[];
  /** Values that cannot be right (a mark above 100, a question mark above its maximum), as student-facing sentences. */
  problems: string[];
}

const CODE = /\b([A-Z]{2,5}\d{4,6}[A-Z]?|IEX-[A-Z]+)\b/i;
const QUESTION = /\bQ(?:uestion)?\s*\.?\s*(\d{1,2}[a-z]?)\s*[:=)-]?\s*(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)/gi;
/** Words allowed on a line that only lists question marks, such as "Question breakdown: Q1 14/20 Q2 9/20". */
const QUESTION_WORDS = /\b(questions?|breakdown|marks?|by|per|exam|paper)\b/gi;
const NUMBER = /(\d+(?:\.\d+)?)\s*(%|\/\s*100\b)?/g;
const DELIMITER = /\t|,|;|\|/;
const HEADER_MARK = /\b(mark|grade|score|result|percentage)s?\b|%/i;
/** Continuation lines that carry the overall mark for the module above them. */
const CONTINUATION_MARK = /^\s*(overall|total|final|module)?\s*(mark|score|total)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?\s*$/i;

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Rounds to one decimal place, so marks such as 62.5 survive and floating-point noise does not. */
const round1 = (x: number) => Math.round(x * 10) / 10;

function questionMarksIn(line: string): { marks: QuestionMark[]; rest: string } {
  const marks: QuestionMark[] = [];
  const rest = line.replace(QUESTION, (_m, id: string, mark: string, max: string) => {
    marks.push({ questionId: `Q${id.toLowerCase()}`, mark: Number(mark), maxMarks: Number(max) });
    return ' ';
  });
  return { marks, rest };
}

/** The longest catalogue title that appears in the text at word boundaries, so "Fluid Mechanics 2" beats "Fluid Mechanics". */
function titleMatch(text: string, catalogue: CatalogueEntry[]): CatalogueEntry | null {
  const haystack = ` ${normalise(text)} `;
  let best: CatalogueEntry | null = null;
  for (const m of catalogue) {
    const needle = normalise(m.title);
    if (needle && haystack.includes(` ${needle} `) && needle.length > normalise(best?.title ?? '').length) best = m;
  }
  return best;
}

/** Removes the first occurrence of a title (case- and punctuation-insensitive) so its digits are not read as the mark. */
function withoutTitle(text: string, title: string): string {
  const words = title.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.replace(new RegExp(words.join('[\\s,;:.-]*'), 'i'), ' ');
}

/** The overall mark in what is left of a line: a percentage or "/100" first, then the last number. */
function markIn(text: string): number | null {
  const found = [...text.matchAll(NUMBER)].map((m) => ({ value: Number(m[1]), flagged: Boolean(m[2]) }));
  if (found.length === 0) return null;
  return (found.findLast((n) => n.flagged) ?? found.at(-1)!).value;
}

/** Splits text into raw rows. Pure text handling: no catalogue lookups beyond telling module lines apart. */
function readRows(text: string, catalogue: CatalogueEntry[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  let markColumn: number | null = null;
  let current: TranscriptRow | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = DELIMITER.test(line) ? line.split(DELIMITER).map((c) => c.trim()) : null;
    const { marks, rest } = questionMarksIn(line);
    const code = CODE.exec(rest)?.[1]?.toUpperCase() ?? null;
    // A row is matched by its code when it has one. Only a row without a code is matched by title, so an unknown
    // code is never stored against a catalogue module that happens to share its title.
    const known = code ? catalogue.find((m) => m.code.toUpperCase() === code || m.id.toUpperCase() === code) : undefined;
    const titled = code ? known : titleMatch(rest, catalogue);

    if (!code && !titled) {
      // A header row of a table says which column holds the mark.
      if (cells && HEADER_MARK.test(line)) markColumn = cells.findIndex((c) => HEADER_MARK.test(c));
      else if (current && marks.length > 0 && !/[a-z]{3,}/i.test(rest.replace(QUESTION_WORDS, ' '))) current.questionMarks.push(...marks);
      else if (current && current.mark === null && CONTINUATION_MARK.test(line)) current.mark = Number(CONTINUATION_MARK.exec(line)![3]);
      continue;
    }

    let remaining = code ? rest.replace(CODE, ' ') : rest;
    if (titled) remaining = withoutTitle(remaining, titled.title);
    let mark: number | null = null;
    if (cells && markColumn !== null && markColumn >= 0 && cells[markColumn] !== undefined) mark = markIn(cells[markColumn]!);
    mark ??= markIn(remaining);
    const writtenTitle = titled ? titled.title : remaining.replace(NUMBER, ' ').replace(/[\s,;:|\t-]+/g, ' ').trim() || null;
    current = { code: code ?? titled?.code ?? null, title: writtenTitle, mark, questionMarks: marks };
    rows.push(current);
  }
  return rows;
}

/**
 * Matches raw rows to the catalogue and validates them. A row with question marks but no overall mark takes the
 * question total as its mark. A later row for the same module replaces an earlier one.
 */
export function toResults(rows: TranscriptRow[], catalogue: CatalogueEntry[], source: ModuleResult['source']): ParsedTranscript {
  const byId = new Map<string, ModuleResult>();
  const problems: string[] = [];
  for (const row of rows) {
    const code = row.code?.trim().toUpperCase() || null;
    const known = code
      ? catalogue.find((m) => m.code.toUpperCase() === code || m.id.toUpperCase() === code)
      : row.title
        ? (titleMatch(row.title, catalogue) ?? undefined)
        : undefined;
    if (!known && !code) continue;
    const name = known ? `${known.code} ${known.title}` : code!;
    const questionMarks = row.questionMarks.filter((q) => Number.isFinite(q.mark) && Number.isFinite(q.maxMarks) && q.maxMarks > 0);
    const over = questionMarks.filter((q) => q.mark < 0 || q.mark > q.maxMarks);
    for (const q of over) problems.push(`${name} ${q.questionId} shows ${q.mark}/${q.maxMarks}, but a question mark cannot be above its maximum.`);
    if (over.length > 0) continue;
    const total = questionMarks.reduce((s, q) => s + q.maxMarks, 0);
    const mark = row.mark ?? (total > 0 ? (questionMarks.reduce((s, q) => s + q.mark, 0) / total) * 100 : null);
    if (mark === null || !Number.isFinite(mark)) continue;
    if (mark < 0 || mark > 100) {
      problems.push(`${name} shows a mark of ${mark}, but marks are percentages from 0 to 100.`);
      continue;
    }
    const moduleId = known?.id ?? code!;
    byId.delete(moduleId);
    byId.set(moduleId, {
      moduleId,
      code: code ?? known!.code,
      title: known?.title ?? (row.title?.trim().slice(0, 120) || null),
      mark: round1(mark),
      questionMarks: questionMarks.map((q) => ({ questionId: q.questionId.trim().slice(0, 20), mark: q.mark, maxMarks: q.maxMarks })),
      matched: Boolean(known),
      source,
    });
  }
  const results = [...byId.values()];
  return { results, unmatched: results.filter((r) => !r.matched).map((r) => r.code), problems };
}

/** Parses pasted transcript text into validated results (spec 23, offline and pasted-text path). */
export function parseTranscript(text: string, catalogue: CatalogueEntry[]): ParsedTranscript {
  return toResults(readRows(text, catalogue), catalogue, 'pasted-text');
}
