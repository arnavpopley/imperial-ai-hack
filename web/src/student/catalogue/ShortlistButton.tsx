import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { Spinner } from '../../components/Spinner.tsx';

interface ShortlistButtonProps {
  title: string;
  shortlisted: boolean;
  pending: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** A toggle button (aria-pressed) that adds a module to the shortlist or removes it. */
export function ShortlistButton({ title, shortlisted, pending, onToggle, size = 'sm', className }: ShortlistButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={shortlisted}
      aria-label={`Shortlist ${title}`}
      disabled={pending}
      onClick={onToggle}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-xl font-medium transition disabled:opacity-60',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-4 text-sm',
        shortlisted
          ? 'bg-brand text-on-brand shadow-soft hover:brightness-110'
          : 'border border-line-strong bg-surface text-ink hover:border-brand/50 hover:text-brand',
        className,
      )}
    >
      {pending ? <Spinner size={14} /> : <Icon name={shortlisted ? 'check' : 'bookmark'} size={14} />}
      <span aria-hidden="true">{shortlisted ? 'Shortlisted' : 'Shortlist'}</span>
    </button>
  );
}
