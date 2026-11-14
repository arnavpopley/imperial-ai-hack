// Hand-drawn 24px stroke icons, so the app needs no icon dependency.
import type { ReactNode } from 'react';

const paths = {
  'arrow-down': <path d="M12 5v14m7-7-7 7-7-7" />,
  'arrow-left': <path d="m12 19-7-7 7-7M19 12H5" />,
  'arrow-right': <path d="M5 12h14m-7-7 7 7-7 7" />,
  'arrow-up': <path d="m5 12 7-7 7 7M12 19V5" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  bookmark: <path d="M18 21l-6-4-6 4V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />,
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </>
  ),
  chat: <path d="M20 14.5a2 2 0 0 1-2 2H8l-4.5 4V5.5a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  chart: <path d="M3.5 20.5h17M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5" />,
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9.5 9.5h5v5h-5zM9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9h3.5M2.5 15h3.5M18 9h3.5M18 15h3.5" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5z" />
    </>
  ),
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  external: <path d="M14 4h6v6M10 14 20 4M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5" />,
  'eye-off': (
    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
  ),
  flame: <path d="M12 21.5c3.9 0 6.5-2.6 6.5-6.3 0-4.6-4-6.6-4.6-11.2C11 6 10 8.6 10.4 11c-1.2-.6-2-1.8-2.3-3.1-1.6 1.5-2.6 3.6-2.6 6.4 0 4.3 2.6 7.2 6.5 7.2z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  heart: (
    <path d="M20.4 5.1a5 5 0 0 0-7.1 0L12 6.4l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 20.6l8.4-8.4a5 5 0 0 0 0-7.1z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4.5M12 8h.01" />
    </>
  ),
  lifebuoy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5.6 5.6 3.9 3.9M14.5 9.5l3.9-3.9M14.5 14.5l3.9 3.9M9.5 14.5l-3.9 3.9" />
    </>
  ),
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  mountain: <path d="m2.5 20 7-12 4 6.5 2.5-4 5.5 9.5zM7.5 11.5l2 1.5 2-1.5" />,
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2 0-1.4-1.3-1.6-1.3-2.9 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7" r="1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  reset: <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.9-3.9" />
    </>
  ),
  send: <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z" />,
  shield: <path d="M12 21.5s7.5-3.6 7.5-9.4V5.6L12 3 4.5 5.6v6.5c0 5.8 7.5 9.4 7.5 9.4z" />,
  sliders: <path d="M4 20v-6M4 10V4M12 20v-8M12 8V4M20 20v-4M20 12V4M2 14h4M10 8h4M18 16h4" />,
  sparkle: <path d="M12 3.5 13.8 9 19.5 11l-5.7 2-1.8 5.5-1.8-5.5-5.7-2 5.7-2z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  swap: <path d="M16 3.5 20 7.5l-4 4M20 7.5H4M8 20.5l-4-4 4-4M4 16.5h16" />,
  trash: <path d="M3.5 6h17M18.5 6v13.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6m3 0V4.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V6" />,
  tutor: <path d="M22 9.5 12 4.5 2 9.5l10 5 10-5zM6 11.5v5c3.3 2.7 8.7 2.7 12 0v-5M22 9.5v6" />,
  user: (
    <>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M4 21v-1.5A5.5 5.5 0 0 1 9.5 14h5a5.5 5.5 0 0 1 5.5 5.5V21" />
    </>
  ),
  wave: <path d="M2.5 9c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.3 2 4.7 2M2.5 15c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.3 2 4.7 2" />,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  /** Pixel size of the square icon. */
  size?: number;
  className?: string;
  /** Accessible name. Without it the icon is decorative and hidden from assistive technology. */
  label?: string;
}

export function Icon({ name, size = 16, className, label }: IconProps) {
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
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
