import type { Module } from '@modulematch/shared';
import { Badge, type BadgeTone } from './Badge.tsx';

export type ModuleType = Module['type'];

/** I-Explore is teal (info): violet is kept for AI-written content (issue #138). */
const styles: Record<ModuleType, { label: string; tone: BadgeTone }> = {
  core: { label: 'Core', tone: 'neutral' },
  elective: { label: 'Elective', tone: 'brand' },
  'i-explore': { label: 'I-Explore', tone: 'info' },
};

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  core: styles.core.label,
  elective: styles.elective.label,
  'i-explore': styles['i-explore'].label,
};

/** Module type chip: core, elective or I-Explore. */
export function ModuleTypeChip({ variant, className }: { variant: ModuleType; className?: string }) {
  return (
    <Badge tone={styles[variant].tone} className={className}>
      {styles[variant].label}
    </Badge>
  );
}
