import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

const copy = {
  modules: 'Sample of public module descriptions, not an official catalogue',
  synthetic: 'Synthetic timetable data',
  pathways: 'Sample pathways and societies',
} as const;

/** Spec 15: every sample or synthetic dataset is labelled wherever it appears. */
export function SampleDataLabel({ variant = 'modules', className }: { variant?: keyof typeof copy; className?: string }) {
  return (
    <p
      title={copy[variant]}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-muted',
        className,
      )}
    >
      <Icon name="info" size={12} />
      <span>
        <span className="font-semibold">{variant === 'synthetic' ? 'Synthetic data' : 'Sample data'}</span>
        <span className="hidden sm:inline">: {copy[variant]}</span>
      </span>
    </p>
  );
}
