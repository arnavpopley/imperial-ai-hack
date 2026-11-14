// A small stroke icon per pathway, drawn in the same style as components/Icon.
import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  'aerospace-motorsport': <path d="M2.5 15.5 21 8.5l-1.5-2-7 2-5-4-2 1 3 4.5-4 1.5-2-1.5-1 1 2 3zM3 20.5h18" />,
  'energy-transition': <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" />,
  'robotics-automation': (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <path d="M12 4.5V8M9.5 13h.01M14.5 13h.01M9.5 16.5h5M2.5 12.5v3M21.5 12.5v3" />
    </>
  ),
  'biomedical-devices': <path d="M3 12h4l2-5 4 10 2-5h6" />,
  'software-data': <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />,
  consulting: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3 12.5h18" />
    </>
  ),
  'startup-founder': (
    <path d="M12 15.5 8.5 12c1.5-5 5-8.5 11-9-.5 6-4 9.5-9 11zM8.5 12 5 11.5l2-3.5h4M12 15.5l.5 3.5 3.5-2v-4M5.5 18.5c-.5-1.5 0-3 1.5-3.5" />
  ),
  'research-academia': <path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-10V3M7.5 14.5h9" />,
};

const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5z" />
  </>
);

export function PathwayIcon({ pathwayId, size = 18, className }: { pathwayId: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[pathwayId] ?? FALLBACK}
    </svg>
  );
}
