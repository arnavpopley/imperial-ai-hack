// Issue 107: an escalation's title names the module and the kind of request, so two requests never look alike.
import type { Escalation, EscalationType } from '@modulematch/shared';

/** The kind of request, in the words staff and students both see. */
export const REQUEST_KINDS: Record<EscalationType, string> = {
  RULE_EXCEPTION: 'Rule exception',
  LOW_CONFIDENCE: 'Help with recommendations',
  WELLBEING: 'Wellbeing hand-off',
  COMPLAINT: 'Complaint',
};

/** The module a request is about, named as "CODE Title", or null when it names none (or the module is unknown). */
export function requestModule(
  e: Pick<Escalation, 'request'>,
  moduleOf: (id: string) => { code: string; title: string } | undefined,
): { code: string; title: string } | null {
  const id = e.request?.moduleId;
  if (!id) return null;
  return moduleOf(id) ?? { code: id, title: '' };
}

/** "MECH70002 Nuclear Reactor Physics · Rule exception", or just the kind when no module is named. */
export function escalationTitle(
  e: Pick<Escalation, 'type' | 'request'>,
  moduleOf: (id: string) => { code: string; title: string } | undefined,
): string {
  const module = requestModule(e, moduleOf);
  const named = module ? [module.code, module.title].filter(Boolean).join(' ') : null;
  return named ? `${named} · ${REQUEST_KINDS[e.type]}` : REQUEST_KINDS[e.type];
}
