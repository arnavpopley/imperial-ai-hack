// Resolves what an explanation's "because" item cites (spec 10.5): an evidence quote or a module field.
import type { Evidence, ExplanationReason, Module } from '@modulematch/shared';
import type { EvidencePopoverProps } from '../../components/EvidencePopover.tsx';
import { humanise, skillLabel, slotLabel, topicLabel } from '../labels.ts';

/** Walks a dotted path such as "topics.fluid-mechanics" or "demand.mathsIntensity" on the module record. */
function readField(module: Module, path: string): unknown {
  let current: unknown = module;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatField(value: unknown): string {
  if (typeof value === 'number') return value <= 1 ? `${value.toFixed(2)} (${Math.round(value * 100)}%)` : String(value);
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 177)}…` : value;
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).join(', ') : 'None';
  return JSON.stringify(value);
}

function fieldLabel(path: string, pathwayTitle: (id: string) => string): string {
  const [head = '', ...rest] = path.split('.');
  const key = rest.join('.');
  switch (head) {
    case 'topics':
      return key ? `Topic weight: ${topicLabel(key)}` : 'Topics';
    case 'skills':
      return key ? `Skill: ${skillLabel(key)}` : 'Skills';
    case 'demand':
      return key ? `Demand: ${humanise(key)}` : 'Demand profile';
    case 'pathwayRelevance':
      return key ? `Pathway relevance: ${pathwayTitle(key)}` : 'Pathway relevance';
    default:
      return humanise(path);
  }
}

/** Popover props for a reason, or null when the reason cites nothing (G6 should have dropped it). */
export function reasonSource(
  reason: ExplanationReason,
  evidence: readonly Evidence[],
  module: Module | undefined,
  pathwayTitle: (id: string) => string,
): EvidencePopoverProps | null {
  if (reason.evidenceId) {
    const ev = evidence.find((e) => e.id === reason.evidenceId);
    return ev
      ? { variant: 'quote', quote: ev.quote, slotLabel: slotLabel(ev.slot), confidence: ev.confidence }
      : { variant: 'missing' };
  }
  if (reason.moduleField) {
    const value = module ? readField(module, reason.moduleField) : undefined;
    return value === undefined
      ? { variant: 'missing' }
      : { variant: 'module-field', fieldLabel: fieldLabel(reason.moduleField, pathwayTitle), value: formatField(value) };
  }
  return null;
}
