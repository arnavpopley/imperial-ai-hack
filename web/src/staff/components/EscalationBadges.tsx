// Escalation type and status badges. Each type routes to one staff queue (spec 11.1). Both are the shared Badge
// (issue #141): one radius, sentence case, the shared tones.
import type { EscalationStatus, EscalationType } from '@modulematch/shared';
import type { ComponentType, SVGProps } from 'react';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { CheckIcon, CompassIcon, GavelIcon, HeartIcon, MessageIcon } from './icons.tsx';

type IconComponent = ComponentType<Omit<SVGProps<SVGSVGElement>, 'children'>>;

/** Violet is kept for AI-written content (issue #138), so a low-confidence case is amber, a caution. */
export const ESCALATION_TYPES: Record<EscalationType, { label: string; queue: string; Icon: IconComponent; tone: BadgeTone }> = {
  RULE_EXCEPTION: { label: 'Rule exception', queue: 'Senior Tutor', Icon: GavelIcon, tone: 'brand' },
  LOW_CONFIDENCE: { label: 'Low confidence', queue: 'Personal tutor', Icon: CompassIcon, tone: 'warning' },
  WELLBEING: { label: 'Wellbeing', queue: 'Student support', Icon: HeartIcon, tone: 'info' },
  COMPLAINT: { label: 'Complaint', queue: 'Admin', Icon: MessageIcon, tone: 'danger' },
};

export function TypeBadge({ type }: { type: EscalationType }) {
  const t = ESCALATION_TYPES[type];
  return (
    <Badge tone={t.tone} size="md" icon={<t.Icon className="size-3.5" />}>
      {t.queue}
      <span className="sr-only">, {t.label}</span>
    </Badge>
  );
}

const STATUS: Record<EscalationStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'warning' },
  claimed: { label: 'Claimed', tone: 'brand' },
  resolved: { label: 'Resolved', tone: 'success' },
};

/** Status as an outlined badge: a dot while the case is live, a tick once it is resolved. */
export function StatusBadge({ status }: { status: EscalationStatus }) {
  const s = STATUS[status];
  return (
    <Badge
      tone={s.tone}
      variant="outline"
      size="md"
      dot={status !== 'resolved'}
      icon={status === 'resolved' ? <CheckIcon className="size-3.5" /> : undefined}
    >
      {s.label}
    </Badge>
  );
}
