import type { Module } from '@modulematch/shared';
import { cx } from './cx.ts';

export type ModuleType = Module['type'];

const styles: Record<ModuleType, { label: string; className: string }> = {
  core: { label: 'Core', className: 'bg-ink/6 text-ink' },
  elective: { label: 'Elective', className: 'bg-brand-soft text-brand' },
  'i-explore': { label: 'I-Explore', className: 'bg-mode-explain/12 text-mode-explain' },
};

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  core: styles.core.label,
  elective: styles.elective.label,
  'i-explore': styles['i-explore'].label,
};

/** Module type chip: core, elective or I-Explore. */
export function ModuleTypeChip({ variant, className }: { variant: ModuleType; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-semibold tracking-wide uppercase',
        styles[variant].className,
        className,
      )}
    >
      {styles[variant].label}
    </span>
  );
}
