// Editable copy of a module's derived fields, plus the diff and request body the tag editor saves.
import type { DerivedEditBody, Module, ModuleDemand, SuggestedEdit } from '@modulematch/shared';

export interface DerivedDraft {
  topics: Record<string, number>;
  skills: Record<string, number>;
  pathwayRelevance: Record<string, number>;
  demand: ModuleDemand;
}

export type WeightField = 'topics' | 'skills' | 'pathwayRelevance';

export const draftFrom = (m: Module): DerivedDraft => ({
  topics: { ...m.topics },
  skills: { ...m.skills },
  pathwayRelevance: { ...m.pathwayRelevance },
  demand: { ...m.demand },
});

export interface Change {
  key: string;
  before: number | null;
  after: number | null;
}

/** Sliders step in 0.05, so anything closer than this is the same value. */
const EPSILON = 1e-6;

function diffRecord(before: Record<string, number>, after: Record<string, number>): Change[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => {
    const b = before[key] ?? null;
    const a = after[key] ?? null;
    if (b !== null && a !== null && Math.abs(a - b) < EPSILON) return [];
    return [{ key, before: b, after: a }];
  });
}

export type DraftDiff = Record<WeightField | 'demand', Change[]>;

export function diffDraft(before: DerivedDraft, after: DerivedDraft): DraftDiff {
  return {
    topics: diffRecord(before.topics, after.topics),
    skills: diffRecord(before.skills, after.skills),
    pathwayRelevance: diffRecord(before.pathwayRelevance, after.pathwayRelevance),
    demand: diffRecord(before.demand, after.demand),
  };
}

export const changeCount = (diff: DraftDiff) => Object.values(diff).reduce((n, list) => n + list.length, 0);

/** The draft with one suggested edit applied (from an accepted insight); nothing is saved until staff save it. */
export function applySuggestedEdit(draft: DerivedDraft, edit: SuggestedEdit | null): DerivedDraft {
  if (!edit) return draft;
  return edit.group === 'topics'
    ? { ...draft, topics: { ...draft.topics, [edit.key]: edit.value } }
    : { ...draft, demand: { ...draft.demand, [edit.key]: edit.value } };
}

/** Sends only the groups that changed; the PUT body is a partial update (spec 13). */
export function editBody(draft: DerivedDraft, diff: DraftDiff): DerivedEditBody {
  return {
    ...(diff.topics.length > 0 && { topics: draft.topics }),
    ...(diff.skills.length > 0 && { skills: draft.skills }),
    ...(diff.pathwayRelevance.length > 0 && { pathwayRelevance: draft.pathwayRelevance }),
    ...(diff.demand.length > 0 && { demand: draft.demand }),
  };
}
