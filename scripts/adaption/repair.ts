// Repair: Adaption's free-form labels mapped onto the whitelist.
// Adaptive Data kept the prompt/completion shape of the seed but invented slot names (style.collaboration,
// interest:aerodynamics, timetablePrefs.unavailable_days) and values (true, "solo", ["Friday"]). These rules translate
// a label only where its meaning is unambiguous and drop everything else, so a repaired label records what Adaption
// meant, never a guess of ours. The rules look only at Adaption's label, never at the student's answer.
import { isAllowedSlot, schemas } from '@modulematch/shared';
import { PATHWAY_IDS, splitPrompt, stepFor, validateRow, type LabelUpdate, type ParsedRow, type RejectReason, type Row } from './rows.ts';

const norm = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();

/** Free-form interest names to taxonomy topics. Deliberately narrow: no rule for physics, education or similar names. */
const TOPIC_NAMES: [RegExp, string][] = [
  [/aerodynamic|fluid/, 'fluid-mechanics'],
  [/thermodynamic|heat transfer/, 'thermodynamics-energy'],
  [/renewable|sustainab|climate/, 'sustainability-climate'],
  [/machine learning|deep learning|neural|\bai\b|artificial intelligence/, 'machine-learning-ai'],
  [/statistic|data analysis|quantitative data/, 'statistics-data'],
  [/^mathematics$|calculus/, 'mathematics-modelling'],
  [/^(behaviou?ral )?economics$|^finance$|game theory/, 'finance-economics'],
  [/entrepreneur|start ?up/, 'entrepreneurship-innovation'],
  [/^psychology$|neuroscience|behaviou?ral science|cognitive science/, 'psychology-behaviour'],
  [/^philosophy$|history of philosophy/, 'history-philosophy'],
  [/public policy|^policy$/, 'policy-ethics'],
  [/computer science|^programming$|software engineering|web development|full stack/, 'programming-software'],
  [/robot/, 'control-robotics'],
  [/electronic/, 'electronics-embedded'],
  [/^manufacturing$/, 'design-manufacturing'],
  [/computational model|simulation/, 'computational-simulation'],
  [/public speaking|^debate$|academic writing/, 'communication-writing'],
];

const PATHWAY_NAMES: [RegExp, string][] = [
  [/phd|research|academi/, 'research-academia'],
  [/consult/, 'consulting'],
  [/own (company|business|firm)|start ?up|founder|entrepreneur/, 'startup-founder'],
  [/aerospace|motorsport|formula/, 'aerospace-motorsport'],
  [/energy|renewable|nuclear/, 'energy-transition'],
  [/robot|automation/, 'robotics-automation'],
  [/software|data scien|developer/, 'software-data'],
  [/biomedical|medical device|medtech/, 'biomedical-devices'],
];

const DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri']);

/** An interest value: true is a stated interest (0.8), false a stated dislike, a fraction is kept. */
function strength(value: unknown): Omit<LabelUpdate, 'slot'> | null {
  if (value === false) return { value: 0, dislike: true };
  if (typeof value === 'number' && value >= 0 && value <= 1) return { value };
  if (value === true || typeof value === 'string' || Array.isArray(value)) return { value: 0.8 };
  return null;
}

const textOf = (value: unknown) => norm(Array.isArray(value) ? value.join(' ') : value && typeof value === 'object' ? JSON.stringify(value) : String(value));

/** Maps one free-form update onto the whitelist, or returns null when its meaning is not clear. */
export function repairUpdate(u: { slot?: unknown; value?: unknown; dislike?: unknown } | null): LabelUpdate | null {
  if (!u || typeof u !== 'object') return null;
  const slot = String(u.slot ?? '');
  const value = u.value;
  if (isAllowedSlot(slot) && schemas.slotValueSchema(slot)!.safeParse(value).success) {
    if (slot === 'pathways' && !(value as string[]).every((id) => PATHWAY_IDS.includes(id))) return repairPathways(value);
    return { slot, value: value as LabelUpdate['value'], ...(u.dislike === true ? { dislike: true } : {}) };
  }
  const name = norm(slot.replace(/^(interest:|style\.|timetablePrefs\.)/, ''));
  const v = textOf(value);
  if (slot.startsWith('interest:')) {
    const topic = TOPIC_NAMES.find(([re]) => re.test(name))?.[1];
    const s = topic ? strength(value) : null;
    return topic && s ? { slot: `interest:${topic}`, ...s } : null;
  }
  if (slot === 'pathways') return repairPathways(value);
  if (slot.startsWith('style.')) {
    if (/collaborat|team|group/.test(name)) {
      if (/solo|individual|alone|independent/.test(v)) return { slot: 'style.groupPreference', value: 0.2 };
      if (/team|group|collaborative/.test(v)) return { slot: 'style.groupPreference', value: 0.8 };
    }
    if (/assessment|exam/.test(name)) {
      if (/mix|both|balance/.test(v)) return { slot: 'style.examPreference', value: 0.5 };
      if (/project|coursework|portfolio|essay/.test(v)) return { slot: 'style.examPreference', value: 0.2 };
      if (/exam|test/.test(v)) return { slot: 'style.examPreference', value: 0.85 };
    }
    if (/learning approach|curriculum balance|applied|theory/.test(name)) {
      const practical = value && typeof value === 'object' ? (value as Record<string, unknown>).practical : undefined;
      if (typeof practical === 'number') return { slot: 'style.appliedPreference', value: Math.round(practical) / 100 };
      if (/applied|practical|hands on/.test(v)) return { slot: 'style.appliedPreference', value: 0.85 };
      if (/theor/.test(v)) return { slot: 'style.appliedPreference', value: 0.2 };
    }
    return null;
  }
  if (slot.startsWith('timetablePrefs.')) {
    if (/unavailable days|avoid days|days off|blocked days/.test(name)) {
      const days = [...new Set((Array.isArray(value) ? value : [value]).map((d) => String(d).toLowerCase().slice(0, 3)).filter((d) => DAYS.has(d)))];
      return days.length ? { slot: 'timetablePrefs.avoidDays', value: days } : null;
    }
    if (/min start|earliest|start time/.test(name)) {
      const hour = typeof value === 'number' ? value : Number(String(value).match(/^(\d{1,2})/)?.[1]);
      if (Number.isInteger(hour) && hour >= 7 && hour <= 12) return { slot: 'timetablePrefs.earliestStart', value: `${String(hour).padStart(2, '0')}:00` };
    }
  }
  return null;
}

function repairPathways(value: unknown): LabelUpdate | null {
  const names = (Array.isArray(value) ? value : [value]).map(String);
  const ids = [...new Set(names.flatMap((n) => (PATHWAY_IDS.includes(n) ? [n] : PATHWAY_NAMES.filter(([re]) => re.test(norm(n))).map(([, id]) => id))))];
  return ids.length ? { slot: 'pathways', value: ids.slice(0, 3) } : null;
}

/** Rejections that come from the label alone, which a repair may fix. Format, question and privacy rejections stand. */
export const LABEL_REASONS: RejectReason[] = ['slot not whitelisted', 'value invalid for its slot', 'unknown pathway id', 'dislike is not a boolean', 'dislike on a non-interest slot', 'duplicate slot in one completion'];

/** Repairs a row whose label failed validation. Returns null when no update maps onto the whitelist. */
export function repairRow(row: Row): { row: ParsedRow; kept: number; dropped: string[] } | null {
  const parts = splitPrompt(row.prompt);
  const step = parts && stepFor(parts.question);
  if (!parts || !step) return null;
  const raw = (JSON.parse(row.completion) as { updates: ({ slot?: unknown; value?: unknown; dislike?: unknown } | null)[] }).updates;
  const updates: LabelUpdate[] = [];
  const dropped: string[] = [];
  for (const u of raw) {
    const fixed = repairUpdate(u);
    if (fixed && !updates.some((x) => x.slot === fixed.slot)) updates.push(fixed);
    else dropped.push(u && typeof u === 'object' ? String(u.slot) : JSON.stringify(u));
  }
  if (updates.length === 0) return null;
  const completion = JSON.stringify({ updates });
  const check = validateRow({ prompt: row.prompt, completion });
  return check.ok ? { row: check.row, kept: updates.length, dropped } : null;
}
