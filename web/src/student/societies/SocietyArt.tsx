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
  'design-manufacturing': { icon: 'wrench', gradient: 'from-art-3 to-art-5' },
  'control-robotics': { icon: 'chip', gradient: 'from-art-7 to-art-2' },
  'electronics-embedded': { icon: 'chip', gradient: 'from-art-7 to-art-4' },
  'fluid-mechanics': { icon: 'wave', gradient: 'from-art-7 to-art-1' },
  'thermodynamics-energy': { icon: 'flame', gradient: 'from-art-3 to-art-6' },
  'nuclear-energy': { icon: 'flame', gradient: 'from-art-5 to-art-3' },
  'biomedical-engineering': { icon: 'heart', gradient: 'from-art-6 to-art-4' },
  'finance-economics': { icon: 'chart', gradient: 'from-art-2 to-art-8' },
  'entrepreneurship-innovation': { icon: 'sparkle', gradient: 'from-art-5 to-art-6' },
  'management-leadership': { icon: 'user', gradient: 'from-art-1 to-art-2' },
  'creative-arts-design': { icon: 'palette', gradient: 'from-art-6 to-art-3' },
  'global-development': { icon: 'globe', gradient: 'from-art-2 to-art-7' },
  languages: { icon: 'globe', gradient: 'from-art-4 to-art-1' },
  'mathematics-modelling': { icon: 'grid', gradient: 'from-art-1 to-art-4' },
  'statistics-data': { icon: 'chart', gradient: 'from-art-1 to-art-2' },
  'programming-software': { icon: 'code', gradient: 'from-art-4 to-art-7' },
  'machine-learning-ai': { icon: 'sparkle', gradient: 'from-art-4 to-art-6' },
  'communication-writing': { icon: 'edit', gradient: 'from-art-8 to-art-2' },
  'history-philosophy': { icon: 'bookmark', gradient: 'from-art-5 to-art-8' },
  'sustainability-climate': { icon: 'globe', gradient: 'from-art-8 to-art-2' },
};

/** For a society with no topics (such as hiking), something outdoorsy rather than a blank. */
const FALLBACK: Art = { icon: 'mountain', gradient: 'from-art-8 to-art-7' };

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
