// A counterfactual insight's suggested edit, as text. The engine puts it in the card's id, so a staff
// decision stays with the change it was made on, and the tag editor can open with that change filled in.
import { TOPIC_IDS } from './constants.ts';
import * as S from './schemas.ts';
import type { ModuleDemand } from './types.ts';

/** One derived field set to a new value: a topic's weight, or a demand field. Both run from 0 to 1. */
export type SuggestedEdit = { group: 'topics'; key: string; value: number } | { group: 'demand'; key: keyof ModuleDemand; value: number };

const DEMAND_KEYS = Object.keys(S.ModuleDemand.shape) as (keyof ModuleDemand)[];
const COUNTERFACTUAL_ID = ':COUNTERFACTUAL:';
const EDIT_PATTERN = /^(topics|demand)\.([A-Za-z-]+)=(\d+(?:\.\d+)?)$/;

/** "demand.examShare=0.4": the value rounded to two decimal places, as the tag editor's sliders allow. */
export const formatSuggestedEdit = (edit: SuggestedEdit): string =>
  `${edit.group}.${edit.key}=${Math.round(edit.value * 100) / 100}`;

/** The edit in `text`, or null for anything that is not a known topic or demand field set to 0 to 1. */
export function parseSuggestedEdit(text: string): SuggestedEdit | null {
  const match = EDIT_PATTERN.exec(text);
  if (!match) return null;
  const [, group, key = '', raw = ''] = match;
  const value = Number(raw);
  if (!(value >= 0 && value <= 1)) return null;
  if (group === 'topics') return (TOPIC_IDS as readonly string[]).includes(key) ? { group, key, value } : null;
  return (DEMAND_KEYS as readonly string[]).includes(key) ? { group: 'demand', key: key as keyof ModuleDemand, value } : null;
}

/** Id of the counterfactual card that suggests `edit` for a module. */
export const counterfactualInsightId = (moduleId: string, edit: SuggestedEdit): string =>
  `${moduleId}${COUNTERFACTUAL_ID}${formatSuggestedEdit(edit)}`;

/** The edit a counterfactual card suggests, read from its id; null for any other card, or the summary card. */
export function suggestedEditOf(insightId: string): SuggestedEdit | null {
  const at = insightId.lastIndexOf(COUNTERFACTUAL_ID);
  return at < 0 ? null : parseSuggestedEdit(insightId.slice(at + COUNTERFACTUAL_ID.length));
}
