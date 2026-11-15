// The ModuleMatch mark: a flat blue tile with a white "M" whose last stroke rises like a tick (a module that
// matches), and one yellow dot. No gradients, so it reads the same at 16px and in both themes.
import { cx } from './cx.ts';

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cx('shrink-0', className)}>
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path
        d="M8.5 22.5V10.5l7.5 8 5-5.5 3.5-4"
        fill="none"
        className="stroke-on-brand"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="22" r="2.6" className="fill-accent" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('text-lg font-bold tracking-tight', className)}>
      Module<span className="text-brand">Match</span>
    </span>
  );
}
