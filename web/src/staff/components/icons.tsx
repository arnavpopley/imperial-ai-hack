// Staff icon names, drawn by the shared 24px icon set (issue #142), so both halves of the app use one stroke and
// one optical size. Each takes only a className; the default size matches the old 16px staff icons.
import { Icon, type IconName } from '../../components/Icon.tsx';

type StaffIconProps = { className?: string };

const shim = (name: IconName) => {
  const StaffIcon = ({ className = 'size-4' }: StaffIconProps) => <Icon name={name} size={16} className={`shrink-0 ${className}`} />;
  return StaffIcon;
};

export const TrendUpIcon = shim('trend-up');
export const EyeIcon = shim('eye');
export const UsersIcon = shim('users');
export const ClockAlertIcon = shim('clock');
export const CheckIcon = shim('check');
export const NoteIcon = shim('note');
export const XIcon = shim('x');
export const LockIcon = shim('lock');
export const ShieldIcon = shim('shield');
export const SearchIcon = shim('search');
export const AlertIcon = shim('alert');
export const InboxIcon = shim('inbox');
export const ArrowLeftIcon = shim('arrow-left');
export const PlusIcon = shim('plus');
export const HeartIcon = shim('heart');
export const GavelIcon = shim('gavel');
export const MessageIcon = shim('chat');
export const CompassIcon = shim('compass');
export const SparkIcon = shim('sparkle');
export const GridIcon = shim('grid');
export const ChevronDownIcon = shim('chevron-down');
export const GaugeIcon = shim('gauge');
export const CalendarIcon = shim('calendar');
export const ArrowUpIcon = shim('arrow-up');
export const ArrowDownIcon = shim('arrow-down');
export const TrashIcon = shim('trash');
export const SendIcon = shim('send');
export const UndoIcon = shim('undo');
export const PencilIcon = shim('edit');
export const ExamIcon = shim('exam');
export const InfoIcon = shim('info');
