// Stroke icons drawn on a 20px grid. Decorative: always pair them with a visible text label.
import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Icon({ children, className = 'size-4', ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {children}
    </svg>
  );
}

export const TrendUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 14l5-5 3 3 6-6" />
    <path d="M12 6h5v5" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
    <circle cx="10" cy="10" r="2.5" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7.5" cy="7" r="2.75" />
    <path d="M2.5 16c.5-2.75 2.5-4.25 5-4.25s4.5 1.5 5 4.25" />
    <path d="M13 4.5a2.5 2.5 0 010 5M14.5 11.9c1.6.5 2.7 1.9 3 4.1" />
  </Icon>
);

export const ClockAlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4l2.5 2.5" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </Icon>
);

export const NoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 3.5h7l3 3v10H5z" />
    <path d="M8 9.5h4.5M8 12.5h4.5" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="9" width="12" height="8" rx="2" />
    <path d="M7 9V6.5a3 3 0 016 0V9" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.5l6 2.5v4.5c0 3.75-2.5 6.5-6 8-3.5-1.5-6-4.25-6-8V5z" />
    <path d="M7.5 10l2 2 3.25-3.5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="5.25" />
    <path d="M13 13l4 4" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3l7.5 13.5h-15z" />
    <path d="M10 8.5v3.5M10 14.25v.01" />
  </Icon>
);

export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11l2-7h10l2 7v5H3z" />
    <path d="M3 11h4l1 2h4l1-2h4" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 10H4M9 5l-5 5 5 5" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Icon>
);

export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 16.5S3 12.5 3 7.75A3.25 3.25 0 0110 6a3.25 3.25 0 017 1.75C17 12.5 10 16.5 10 16.5z" />
  </Icon>
);

export const GavelIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 3.5l5.5 5.5M8.5 6l5.5 5.5M9.75 4.75l-3.5 3.5M15.25 10.25l-3.5 3.5M9 10l-6 6" />
  </Icon>
);

export const MessageIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 4.5h13v9H9l-4 3v-3H3.5z" />
  </Icon>
);

export const CompassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M12.75 7.25L11 11l-3.75 1.75L9 9z" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4M5 5l2 2M13 13l2 2M15 5l-2 2M7 13l-2 2" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="5.5" height="5.5" rx="1.25" />
    <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.25" />
    <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.25" />
    <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.25" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5.5 8 4.5 4.5L14.5 8" />
  </Icon>
);

export const GaugeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 14a6.5 6.5 0 1 1 13 0" />
    <path d="m10 14 3-4.5" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="14" height="13" rx="2" />
    <path d="M13 2.5v3M7 2.5v3M3 8.5h14" />
  </Icon>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 16V4M5 9l5-5 5 5" />
  </Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4v12M5 11l5 5 5-5" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.75 11h7.5l.75-11M8.5 8.5v5.5M11.5 8.5v5.5" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 3L8.5 11.5M17 3l-5 14-3.5-5.5L3 8z" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5L3.5 8 7 11.5" />
    <path d="M3.5 8h8.25a4.75 4.75 0 010 9.5H9" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12.5 4l3.5 3.5-8.75 8.75H3.75V12.75z" />
    <path d="M10.75 5.75l3.5 3.5" />
  </Icon>
);

export const ExamIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="2.5" width="12" height="15" rx="2" />
    <path d="M7 6.5h6M7 9.5h6M7 12.5h3" />
    <path d="M11.5 13.5l1.25 1.25 2.25-2.5" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 9v4.5M10 6.5v.01" />
  </Icon>
);
