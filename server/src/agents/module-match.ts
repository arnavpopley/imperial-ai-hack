// Which module a chat shortlist command names (spec 10.1: clarify rather than guess). Exact codes and titles
// win; anything looser is matched only among the modules the command could act on, and a weak or tied
// match becomes a "Did you mean …?" question instead of an edit. A mention is one contiguous phrase, so
// words from two different module names are never combined into a third.
import type { Module } from '@modulematch/shared';

/** Words that say nothing about which module is meant. Single letters ("A" in "Vibrations A") are dropped too. */
const STOPWORDS = new Set(['and', 'the', 'of', 'for', 'to', 'in', 'on', 'with', 'an', 'my', 'from', 'off', 'module', 'modules']);
/** Suggestions offered in one "Did you mean …?" question. */
export const MAX_SUGGESTIONS = 3;

const tokens = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const significant = (word: string): boolean => word.length >= 2 && !STOPWORDS.has(word);

/** [start, end) word positions in the student's text. */
type Span = [number, number];

interface Mention {
  id: string;
  kind: 'code' | 'title';
  span: Span;
  /** The module's full title after its code ("MECH70015 Computational Fluid Dynamics"): part of the same mention. */
  titleSpan?: Span;
}

export interface ModuleMatch {
  /** Modules named exactly (code or full title) or matched strongly within the pool. Some may be outside the pool. */
  matched: string[];
  /** Pool modules to offer as "Did you mean …?", best first, when a match is missing, weak or tied. */
  suggestions: string[];
}

/**
 * Codes, then full titles longest first, as whole-word sequences. Each match uses up its words, so
 * "Computational Fluid Dynamics" is not also read as "Dynamics", and "Thermodynamics" never contains it.
 */
function exactMentions(said: readonly string[], modules: readonly Module[]): Mention[] {
  const used = said.map(() => false);
  const found: Mention[] = [];
  const take = (m: Module, kind: Mention['kind'], label: string) => {
    const words = tokens(label);
    if (words.length === 0) return;
    for (let i = 0; i + words.length <= said.length; i++) {
      if (words.every((w, k) => said[i + k] === w && !used[i + k])) {
        // Use up the words even when the code already named this module, so "MECH70015 Computational
        // Fluid Dynamics" leaves no "Dynamics" behind for a shorter title.
        for (let k = 0; k < words.length; k++) used[i + k] = true;
        const earlier = found.find((f) => f.id === m.id);
        if (earlier) earlier.titleSpan = [i, i + words.length];
        else found.push({ id: m.id, kind, span: [i, i + words.length] });
        return;
      }
    }
  };
  for (const m of modules) take(m, 'code', m.code);
  for (const m of [...modules].sort((a, b) => b.title.length - a.title.length)) take(m, 'title', m.title);
  return found.sort((a, b) => a.span[0] - b.span[0]);
}

/** Maximal runs of consecutive words that all belong to the title: the phrases that could be naming it. */
function runs(said: readonly string[], title: string): Span[] {
  const words = new Set(tokens(title));
  const out: Span[] = [];
  let start = -1;
  said.forEach((w, i) => {
    if (words.has(w)) start = start < 0 ? i : start;
    else if (start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, said.length]);
  return out;
}

/**
 * Resolves the modules a shortlist command names. `pool` is what the command can act on: the shortlist for a
 * removal, eligible modules not yet shortlisted for an addition.
 *
 * - An exact code always stands. An exact title stands unless a pool module's title covers the same phrase
 *   and more of its words: "remove Machine Dynamics" means Machine Dynamics and Vibrations A, not the Year 2
 *   module called Dynamics, but in "remove Machine Learning and Dynamics" the "Machine" belongs to the other
 *   mention.
 * - Otherwise only pool modules are considered, scored by the title words in their best single phrase. A
 *   unique best match counts when it shares at least two words or all of its words; a weaker or tied one is
 *   only suggested.
 * - Suggestions are pool modules sharing a title word, best first, for anything not settled.
 */
export function matchModules(text: string, modules: readonly Module[], pool: readonly string[]): ModuleMatch {
  const said = tokens(text);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const titleOf = (id: string) => byId.get(id)?.title ?? '';
  const keyWords = (id: string) => new Set(tokens(titleOf(id)).filter(significant));
  /** Key title words in one phrase of the text. */
  const hitsIn = (id: string, [start, end]: Span) => {
    const keys = keyWords(id);
    return new Set(said.slice(start, end).filter((w) => keys.has(w)));
  };
  const mentions = exactMentions(said, modules);
  // Words that name a module by code (with its title) are settled, so they suggest nothing else.
  const open = said.map((w, i) =>
    mentions.some((m) => m.kind === 'code' && [m.span, m.titleSpan].some((span) => span && span[0] <= i && i < span[1])) ? '' : w,
  );
  const scored = pool
    .filter((id) => byId.has(id))
    .map((id) => ({ id, hits: Math.max(0, ...runs(open, titleOf(id)).map((span) => hitsIn(id, span).size)) }))
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const matched: string[] = [];
  let unsettled = false;
  for (const mention of mentions) {
    if (mention.kind === 'code') {
      matched.push(mention.id);
      continue;
    }
    // A pool module whose title phrase contains this whole mention and uses more of its own words.
    const own = keyWords(mention.id);
    const [start, end] = mention.span;
    const fuller = pool.flatMap((id) => {
      if (id === mention.id || !byId.has(id)) return [];
      const run = runs(said, titleOf(id)).find(([a, b]) => a <= start && end <= b);
      const hits = run ? hitsIn(id, run) : new Set<string>();
      return hits.size > own.size && [...own].every((w) => hits.has(w)) ? [{ id, hits: hits.size }] : [];
    });
    const most = Math.max(0, ...fuller.map((c) => c.hits));
    const best = fuller.filter((c) => c.hits === most);
    if (best.length === 1 && best[0]) matched.push(best[0].id);
    else if (best.length > 1) unsettled = true;
    else matched.push(mention.id);
  }

  if (matched.length === 0 && !unsettled) {
    const [top, second] = scored;
    const strong = top && top.hits !== second?.hits && (top.hits >= 2 || top.hits === keyWords(top.id).size);
    if (strong) matched.push(top.id);
  }

  const unique = [...new Set(matched)];
  const settled = unique.length > 0 && unique.every((id) => pool.includes(id));
  const suggestions = settled ? [] : scored.map((c) => c.id).filter((id) => !unique.includes(id)).slice(0, MAX_SUGGESTIONS);
  return { matched: unique, suggestions };
}
