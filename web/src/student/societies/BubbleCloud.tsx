// A slowly revolving cloud of society names: your top matches and the wildcard on the inner ring, larger,
// and other societies on the outer ring. Every bubble is a button in a list, so the cloud works by keyboard;
// the card list beside it carries the same information for screen readers.
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { cx } from '../../components/cx.ts';
import './societies.css';

export interface CloudItem {
  id: string;
  name: string;
  /** Fit 0 to 100 for matched societies, null for the rest of the directory. */
  fit: number | null;
  wildcard: boolean;
}

interface BubbleCloudProps {
  featured: readonly CloudItem[];
  others: readonly CloudItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** id of the detail panel the bubbles describe. */
  detailId: string;
}

/** "Racing (Imperial Racing Green)" reads as "Racing" in a bubble; the card keeps the full name. */
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '');
}

/** Places `count` points evenly on a circle of `radius` percent, starting at the top. */
function position(index: number, count: number, radius: number, offset = 0): CSSProperties {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2 + offset;
  return { left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%` };
}

export function BubbleCloud({ featured, others, selectedId, onSelect, detailId }: BubbleCloudProps) {
  const reduce = useReducedMotion();
  const topFit = Math.max(1, ...featured.map((f) => f.fit ?? 0));

  const bubble = (item: CloudItem, index: number, prominent: boolean) => {
    const selected = item.id === selectedId;
    // Bigger bubbles for better matches, so the top five stand out at a glance.
    const scale = prominent && item.fit !== null && !item.wildcard ? 0.92 + 0.18 * (item.fit / topFit) : 1;
    return (
      <div className="society-upright">
        <motion.button
          type="button"
          aria-pressed={selected}
          aria-controls={detailId}
          onClick={() => onSelect(item.id)}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale }}
          whileHover={reduce ? undefined : { scale: scale * 1.08 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: reduce ? 0 : 0.05 * index }}
          className={cx(
            'block rounded-full text-center leading-tight font-semibold shadow-soft transition-colors',
            prominent
              ? 'max-w-[5.75rem] px-2.5 py-2 text-[10.5px] sm:max-w-[8.5rem] sm:px-3.5 sm:text-[12px]'
              : 'max-w-[5.5rem] px-2 py-1 text-[10px] font-medium sm:max-w-[7rem] sm:text-[11px]',
            item.wildcard
              ? cx(
                  'border-2 border-dashed border-mode-explain bg-mode-explain/12 text-ink',
                  selected && 'ring-2 ring-mode-explain ring-offset-2 ring-offset-surface',
                )
              : selected
                ? 'border border-brand bg-brand text-on-brand'
                : prominent
                  ? 'border border-brand/30 bg-surface text-ink hover:border-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink',
          )}
        >
          {item.wildcard && <span className="block text-[9px] font-bold tracking-[0.08em] uppercase">Wildcard</span>}
          <span className="line-clamp-2">{shortName(item.name)}</span>
          {item.fit !== null && <span className="sr-only">, fit {item.fit}</span>}
        </motion.button>
      </div>
    );
  };

  return (
    <div className="society-cloud relative mx-auto aspect-square w-full max-w-[32rem]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-[9%] rounded-full border border-dashed border-line" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[24%] rounded-full border border-line/70" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[40%] grid place-items-center rounded-full bg-brand-soft text-center">
        <span className="px-2 text-[11px] leading-tight font-semibold text-brand sm:text-[12px]">Picked for you</span>
      </div>

      <ul aria-label="Other societies" className="society-ring absolute inset-0" data-direction="reverse" style={{ '--orbit-duration': '140s' } as CSSProperties}>
        {others.map((item, i) => (
          <li
            key={item.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={position(i, others.length, 39, Math.PI / others.length)}
          >
            {bubble(item, featured.length + i, false)}
          </li>
        ))}
      </ul>
      <ul aria-label="Your top matches" className="society-ring absolute inset-0" style={{ '--orbit-duration': '90s' } as CSSProperties}>
        {featured.map((item, i) => (
          <li key={item.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={position(i, featured.length, 27)}>
            {bubble(item, i, true)}
          </li>
        ))}
      </ul>
    </div>
  );
}
