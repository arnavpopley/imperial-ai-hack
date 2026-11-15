// Which module a chat shortlist command names (spec 10.1: clarify rather than guess). Exact codes and titles
// win; anything looser is matched only among the modules the command could act on, and a weak or tied
// match becomes a "Did you mean …?" question instead of an edit.
import type { Module } from '@modulematch/shared';

/** Words that say nothing about which module is meant. Single letters ("A" in "Vibrations A") are dropped too. */
const STOPWORDS = new Set(['and', 'the', 'of', 'for', 'to', 'in', 'on', 'with', 'an', 'my', 'from', 'off', 'module', 'modules']);
/** Suggestions offered in one "Did you mean …?" question. */
export const MAX_SUGGESTIONS = 3;

const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The phrase as a whole-word, case-insensitive pattern, so "Dynamics" does not match inside "Thermodynamics". */
const phrase = (text: string): RegExp => new RegExp(`(?<![a-z0-9])${escape(text)}(?![a-z0-9])`, 'i');

export interface ModuleMatch {
  /** Modules named exactly (code or full title) or matched strongly within the pool. Some may be outside the pool. */
  matched: string[];
  /** Pool modules to offer as "Did you mean …?", best first, when a match is missing, weak or tied. */
  suggestions: string[];
}

/**
 * Codes, then full titles longest first. Each match is blanked out of the text, so "Computational Fluid
 * Dynamics" is not also read as "Dynamics".
 */
function exactMentions(text: string, modules: readonly Module[]): string[] {
  let rest = text;
  const found: string[] = [];
  const take = (m: Module, label: string) => {
    const pattern = phrase(label);
    if (!pattern.test(rest)) return;
    rest = rest.replace(pattern, ' ');
    if (!found.includes(m.id)) found.push(m.id);
  };
  for (const m of modules) take(m, m.code);
  for (const m of [...modules].sort((a, b) => b.title.length - a.title.length)) take(m, m.title);
  return found;
}

/**
 * Resolves the modules a shortlist command names. `pool` is what the command can act on: the shortlist for a
 * removal, eligible modules not yet shortlisted for an addition.
 *
 * - An exact code or title match wins, unless a pool module matches the student's words more fully: "remove
 *   Machine Dynamics" means Machine Dynamics and Vibrations A, not the Year 2 module called Dynamics.
 * - Otherwise only pool modules are considered, by how many of their title words the student used. A unique
 *   best match counts when it shares at least two words or all of its words; a weaker or tied one is only
 *   suggested.
 * - Suggestions are pool modules sharing a title word, best first, for anything not settled.
 */
export function matchModules(text: string, modules: readonly Module[], pool: readonly string[]): ModuleMatch {
  const said = new Set(words(text));
  const byId = new Map(modules.map((m) => [m.id, m]));
  const titleWords = (id: string) => [...new Set(words(byId.get(id)?.title ?? ''))];
  const hits = (id: string) => titleWords(id).filter((w) => said.has(w));
  const inPool = pool.filter((id) => byId.has(id));
  const ranked = inPool
    .map((id) => ({ id, hits: hits(id).length }))
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const matched: string[] = [];
  let unsettled = false;
  for (const id of exactMentions(text, modules)) {
    // A pool module using every word of this title and more is what the student meant.
    const own = titleWords(id);
    const fuller = ranked.filter((c) => c.id !== id && c.hits > own.length && own.every((w) => hits(c.id).includes(w)));
    const best = fuller.filter((c) => c.hits === fuller[0]?.hits);
    if (best.length === 1 && best[0]) matched.push(best[0].id);
    else if (best.length > 1) unsettled = true;
    else matched.push(id);
  }

  if (matched.length === 0 && !unsettled) {
    const [top, second] = ranked;
    const strong = top && top.hits !== second?.hits && (top.hits >= 2 || top.hits === titleWords(top.id).length);
    if (strong) matched.push(top.id);
  }

  const settled = matched.length > 0 && matched.every((id) => pool.includes(id));
  const suggestions = settled ? [] : ranked.map((c) => c.id).filter((id) => !matched.includes(id)).slice(0, MAX_SUGGESTIONS);
  return { matched: [...new Set(matched)], suggestions };
}
