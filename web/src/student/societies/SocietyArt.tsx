// Each society gets its own artwork: a solid colour and an icon from its strongest topic, so the cards
// and the detail panel read at a glance without needing a photo per society.
import type { Society } from '@modulematch/shared';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';

interface Art {
  icon: IconName;
  /** Solid fill for the banner; a literal class so Tailwind generates it. */
  fill: string;
}

const BY_TOPIC: Record<string, Art> = {
  'design-manufacturing': { icon: 'wrench', fill: 'bg-art-3' },
  'control-robotics': { icon: 'chip', fill: 'bg-art-7' },
  'electronics-embedded': { icon: 'chip', fill: 'bg-art-7' },
  'fluid-mechanics': { icon: 'wave', fill: 'bg-art-7' },
  'thermodynamics-energy': { icon: 'flame', fill: 'bg-art-3' },
  'nuclear-energy': { icon: 'flame', fill: 'bg-art-5' },
  'biomedical-engineering': { icon: 'heart', fill: 'bg-art-6' },
  'finance-economics': { icon: 'chart', fill: 'bg-art-2' },
  'entrepreneurship-innovation': { icon: 'sparkle', fill: 'bg-art-5' },
  'management-leadership': { icon: 'user', fill: 'bg-art-1' },
  'creative-arts-design': { icon: 'palette', fill: 'bg-art-6' },
  'global-development': { icon: 'globe', fill: 'bg-art-2' },
  languages: { icon: 'globe', fill: 'bg-art-4' },
  'mathematics-modelling': { icon: 'grid', fill: 'bg-art-1' },
  'statistics-data': { icon: 'chart', fill: 'bg-art-1' },
  'programming-software': { icon: 'code', fill: 'bg-art-4' },
  'machine-learning-ai': { icon: 'sparkle', fill: 'bg-art-4' },
  'communication-writing': { icon: 'edit', fill: 'bg-art-8' },
  'history-philosophy': { icon: 'bookmark', fill: 'bg-art-5' },
  'sustainability-climate': { icon: 'globe', fill: 'bg-art-8' },
};

/** For a society with no topics (such as hiking), something outdoorsy rather than a blank. */
const FALLBACK: Art = { icon: 'mountain', fill: 'bg-art-8' };

/** The artwork for one topic, or the outdoorsy fallback. */
export function artForTopic(topic: string): Art {
  return BY_TOPIC[topic] ?? FALLBACK;
}

export function artFor(society: Society | undefined): Art {
  if (!society) return FALLBACK;
  const top = Object.entries(society.topics).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (top && BY_TOPIC[top]) || FALLBACK;
}

/** A solid colour banner with the society's icon over a soft dot pattern. */
export function SocietyBanner({ society, className }: { society: Society | undefined; className?: string }) {
  const art = artFor(society);
  return (
    <div
      aria-hidden="true"
      className={cx('relative grid place-items-center overflow-hidden text-white', art.fill, className)}
    >
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1.5px)] [background-size:14px_14px]" />
      <div className="absolute -right-6 -bottom-8 size-28 rounded-full bg-white/15 blur-xl" />
      <span className="relative grid size-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/35 backdrop-blur-sm">
        <Icon name={art.icon} size={28} />
      </span>
    </div>
  );
}
