// A slowly revolving cloud of society names: your top matches and the wildcard on the inner ring, larger,
// and other societies on the outer ring. Every bubble is a button in a list, so the cloud works by keyboard;
// the card list beside it carries the same information for screen readers.
//
// Bubbles are fixed-size circles placed by cloudLayout, which keeps them from overlapping at any width and
// at every point of the orbit. Long names end in an ellipsis; the full name is in the tooltip and the detail panel.
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { cx } from '../../components/cx.ts';
import {
  CENTRE_DIAMETER,
  cloudLayout,
  INNER_MAX,
  INNER_MIN,
  INNER_RADIUS,
  MAX_PER_RING,
  MIN_GAP,
  OUTER_RADIUS,
  smallestGap,
  splitLabel,
  WILDCARD_DIAMETER,
  type Placement,
} from './cloudLayout.ts';
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

/** "Racing (Imperial Racing Green)" reads as "Racing" in a bubble; the tooltip and cards keep the full name. */
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '');
}

/** Share of a bubble's width left for text once its padding is taken off (p-[6%] each side). */
const TEXT_WIDTH = 0.88;
/** Rough width of one Inter character, in em, for fitting the longest line. */
const CHAR_EM = 0.58;

/**
 * Font size for a bubble's label: the ring's usual size, shrunk with the container (cqw) so the longest line
 * fits the circle, within a readable floor. Anything still too wide at the floor ends in an ellipsis.
 */
function labelFontSize(diameter: number, lines: readonly string[], prominent: boolean): string {
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const fit = (diameter * TEXT_WIDTH) / (longest * CHAR_EM);
  const [floor, base, ceiling] = prominent ? [8, 2.3, 12.5] : [7.5, 2.1, 11.5];
  return `clamp(${floor}px, ${Math.min(base, fit).toFixed(2)}cqw, ${ceiling}px)`;
}

/** A guide circle through the centres of one ring, as an inset in percent. */
const ringInset = (radius: number) => `${50 - radius}%`;

export function BubbleCloud({ featured, others, selectedId, onSelect, detailId }: BubbleCloudProps) {
  const reduce = useReducedMotion();
  const inner = featured.slice(0, MAX_PER_RING);
  const topFit = Math.max(1, ...inner.map((f) => f.fit ?? 0));
  // Better matches get bigger bubbles, within the range the layout was checked for.
  const diameters = inner.map((item) =>
    item.wildcard || item.fit === null ? WILDCARD_DIAMETER : INNER_MIN + (INNER_MAX - INNER_MIN) * (item.fit / topFit),
  );
  const layout = cloudLayout(diameters, others.length);
  const outer = others.slice(0, layout.outer.length);

  if (import.meta.env.DEV) {
    const gap = smallestGap([...layout.inner, ...layout.outer]);
    if (gap < MIN_GAP - 1e-9) console.warn(`Society cloud bubbles are ${gap.toFixed(2)}% apart, under the ${MIN_GAP}% minimum`);
  }

  const bubble = (item: CloudItem, place: Placement, index: number, prominent: boolean) => {
    const selected = item.id === selectedId;
    const lines = splitLabel(shortName(item.name), item.wildcard || !prominent ? 2 : 3);
    return (
      <li
        key={item.id}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${place.x}%`, top: `${place.y}%`, width: `${place.diameter}%` }}
      >
        <div className="society-upright aspect-square w-full">
          <motion.button
            type="button"
            aria-pressed={selected}
            aria-controls={detailId}
            title={item.name}
            onClick={() => onSelect(item.id)}
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: reduce ? 0 : 0.05 * index }}
            className={cx(
              'pointer-events-auto flex size-full flex-col items-center justify-center rounded-full p-[6%] text-center leading-[1.15] shadow-soft transition-colors',
              prominent ? 'font-semibold' : 'font-medium',
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
            style={{ fontSize: labelFontSize(place.diameter, lines, prominent) }}
          >
            {item.wildcard && (
              <span className="mb-0.5 block text-[0.75em] font-bold tracking-[0.06em] uppercase">Wildcard</span>
            )}
            {lines.map((line, i) => (
              <span key={`${i}-${line}`} className="block w-full truncate">
                {line}
              </span>
            ))}
            {item.fit !== null && <span className="sr-only">, fit {item.fit}</span>}
          </motion.button>
        </div>
      </li>
    );
  };

  return (
    <div className="society-cloud relative mx-auto aspect-square w-full max-w-[32rem] [container-type:inline-size]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full border border-dashed border-line"
        style={{ inset: ringInset(OUTER_RADIUS) }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full border border-line/70"
        style={{ inset: ringInset(INNER_RADIUS) }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute grid place-items-center rounded-full bg-brand-soft text-center"
        style={{ inset: ringInset(CENTRE_DIAMETER / 2) }}
      >
        <span className="px-2 leading-tight font-semibold text-brand" style={{ fontSize: 'clamp(10px, 2.4cqw, 13px)' }}>
          Picked for you
        </span>
      </div>

      {/* Both rings turn together, so the spacing cloudLayout guarantees holds throughout the orbit. */}
      <div className="society-ring pointer-events-none absolute inset-0">
        <ul aria-label="Your top matches">
          {inner.map((item, i) => {
            const place = layout.inner[i];
            return place ? bubble(item, place, i, true) : null;
          })}
        </ul>
        <ul aria-label="Other societies">
          {outer.map((item, i) => {
            const place = layout.outer[i];
            return place ? bubble(item, place, inner.length + i, false) : null;
          })}
        </ul>
      </div>
    </div>
  );
}
