// Each society gets its own artwork: a colour gradient and an icon from its strongest topic, so the cards
// and the detail panel read at a glance without needing a photo per society.
import type { Society } from '@modulematch/shared';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';

interface Art {
  icon: IconName;
  /** Tailwind gradient stops; literal strings so Tailwind generates them. */
  gradient: string;
}

const BY_TOPIC: Record<string, Art> = {
  'design-manufacturing': { icon: 'wrench', gradient: 'from-module-3 to-module-5' },
  'control-robotics': { icon: 'chip', gradient: 'from-module-7 to-module-2' },
  'electronics-embedded': { icon: 'chip', gradient: 'from-module-7 to-module-4' },
  'fluid-mechanics': { icon: 'wave', gradient: 'from-module-7 to-module-1' },
  'thermodynamics-energy': { icon: 'flame', gradient: 'from-module-3 to-module-6' },
  'nuclear-energy': { icon: 'flame', gradient: 'from-module-5 to-module-3' },
  'biomedical-engineering': { icon: 'heart', gradient: 'from-module-6 to-module-4' },
  'finance-economics': { icon: 'chart', gradient: 'from-module-2 to-module-8' },
  'entrepreneurship-innovation': { icon: 'sparkle', gradient: 'from-module-5 to-module-6' },
  'management-leadership': { icon: 'user', gradient: 'from-module-1 to-module-2' },
  'creative-arts-design': { icon: 'palette', gradient: 'from-module-6 to-module-3' },
  'global-development': { icon: 'globe', gradient: 'from-module-2 to-module-7' },
  languages: { icon: 'globe', gradient: 'from-module-4 to-module-1' },
  'mathematics-modelling': { icon: 'grid', gradient: 'from-module-1 to-module-4' },
  'statistics-data': { icon: 'chart', gradient: 'from-module-1 to-module-2' },
  'programming-software': { icon: 'code', gradient: 'from-module-4 to-module-7' },
  'machine-learning-ai': { icon: 'sparkle', gradient: 'from-module-4 to-module-6' },
  'communication-writing': { icon: 'edit', gradient: 'from-module-8 to-module-2' },
  'history-philosophy': { icon: 'bookmark', gradient: 'from-module-5 to-module-8' },
  'sustainability-climate': { icon: 'globe', gradient: 'from-module-8 to-module-2' },
};

/** For a society with no topics (such as hiking), something outdoorsy rather than a blank. */
const FALLBACK: Art = { icon: 'mountain', gradient: 'from-module-8 to-module-7' };

export function artFor(society: Society | undefined): Art {
  if (!society) return FALLBACK;
  const top = Object.entries(society.topics).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (top && BY_TOPIC[top]) || FALLBACK;
}

/** A gradient banner with the society's icon over a soft dot pattern. */
export function SocietyBanner({ society, className }: { society: Society | undefined; className?: string }) {
  const art = artFor(society);
  return (
    <div
      aria-hidden="true"
      className={cx('relative grid place-items-center overflow-hidden bg-gradient-to-br text-white', art.gradient, className)}
    >
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1.5px)] [background-size:14px_14px]" />
      <div className="absolute -right-6 -bottom-8 size-28 rounded-full bg-white/15 blur-xl" />
      <span className="relative grid size-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/35 backdrop-blur-sm">
        <Icon name={art.icon} size={28} />
      </span>
    </div>
  );
}
