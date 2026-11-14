// Escalation type and status badges. Each type routes to one staff queue (spec 11.1).
import type { EscalationStatus, EscalationType } from '@modulematch/shared';
import type { ComponentType, SVGProps } from 'react';
import { CheckIcon, CompassIcon, GavelIcon, HeartIcon, MessageIcon } from './icons.tsx';

type IconComponent = ComponentType<Omit<SVGProps<SVGSVGElement>, 'children'>>;

export const ESCALATION_TYPES: Record<EscalationType, { label: string; queue: string; Icon: IconComponent; tone: string }> = {
  RULE_EXCEPTION: { label: 'Rule exception', queue: 'Senior Tutor', Icon: GavelIcon, tone: 'bg-brand-soft text-brand' },
  LOW_CONFIDENCE: {
    label: 'Low confidence',
    queue: 'Personal tutor',
    Icon: CompassIcon,
    tone: 'bg-mode-explain/10 text-mode-explain',
  },
  WELLBEING: { label: 'Wellbeing', queue: 'Student support', Icon: HeartIcon, tone: 'bg-mode-plan/10 text-mode-plan' },
  COMPLAINT: { label: 'Complaint', queue: 'Admin', Icon: MessageIcon, tone: 'bg-clash-likely/10 text-clash-likely' },
};

export function TypeBadge({ type }: { type: EscalationType }) {
  const t = ESCALATION_TYPES[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${t.tone}`}>
      <t.Icon className="size-3.5" />
      {t.queue}
      <span className="sr-only">, {t.label}</span>
    </span>
  );
}

const STATUS_LABEL: Record<EscalationStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  resolved: 'Resolved',
};

const STATUS_TONE: Record<EscalationStatus, string> = {
  open: 'border-fit-mid/50 text-ink',
  claimed: 'border-brand/50 text-brand',
  resolved: 'border-fit-high/40 text-fit-high',
};

export function StatusBadge({ status }: { status: EscalationStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_TONE[status]}`}
    >
      {status === 'resolved' ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <span aria-hidden="true" className={`size-1.5 rounded-full ${status === 'open' ? 'bg-fit-mid' : 'bg-brand'}`} />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
