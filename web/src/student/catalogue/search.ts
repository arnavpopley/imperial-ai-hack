// Catalogue search (issue 62): forgiving matching on a module's title, code and topic labels. It only filters,
// so the ranked order the student sees is kept.

/** Lower case, accents and punctuation removed, "&" read as "and", single spaces. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface SearchFields {
  title: string;
  code: string;
  /** Topic labels, for example "Fluid mechanics". */
  topics: readonly string[];
}

/** Levenshtein distance, giving up once it is certain to exceed `limit`. */
function withinEdits(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return false;
    previous = current;
  }
  return previous[b.length]! <= limit;
}

/**
 * Typos allowed in one query word: none under four letters, one up to six, two from seven. None in a word with
 * a digit: module codes differ by a single digit (MECH60018, MECH60019), so a code must match as typed.
 */
const typoAllowance = (word: string) => (/\d/.test(word) || word.length < 4 ? 0 : word.length < 7 ? 1 : 2);

/**
 * True when every word of the query is found in the module's title, code or topic labels: as the start of a
 * word, anywhere inside the text, or within a typo or two of a word (or of the start of a longer one).
 */
export function matchesQuery(fields: SearchFields, query: string): boolean {
  const words = normalise(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const texts = [fields.title, fields.code, fields.code.replace(/\s+/g, ''), ...fields.topics].map(normalise);
  const haystack = texts.join(' ');
  const targets = [...new Set(haystack.split(' ').filter(Boolean))];
  return words.every((word) => {
    if (haystack.includes(word)) return true;
    const allowance = typoAllowance(word);
    if (allowance === 0) return false;
    return targets.some(
      (target) =>
        withinEdits(word, target, allowance) ||
        (target.length > word.length && withinEdits(word, target.slice(0, word.length), allowance)),
    );
  });
}
