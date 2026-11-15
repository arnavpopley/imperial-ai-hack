// Who made a piece of content, at a glance (issue #138): words from the AI, numbers computed by code, the student's
// own words, or a field of the module record. One shape everywhere; violet means AI and nothing else. Each kind is a
// Badge tone (issue #141), so it shares the badge's shape, size and colour tokens.
import { useEffect, useId, useRef, useState } from 'react';
import { BADGE_TONES, Badge, badgeClass, type BadgeTone } from './Badge.tsx';
import { cx } from './cx.ts';
import { Icon, type IconName } from './Icon.tsx';

export type ProvenanceKind = 'ai' | 'code' | 'quote' | 'record';

interface ProvenanceMeta {
  label: string;
  icon: IconName;
  /** The Badge tone this kind is drawn in. */
  badge: BadgeTone;
  /** Tint and text colour classes, from the Badge tone. */
  tone: string;
  /** The colour tokens behind `tone`, so a test can check 4.5:1 or better in light and dark. */
  colours: { text: string; tint: string; alpha: number };
  /** One line for the legend and the tooltip. */
  meaning: string;
}

const define = (label: string, icon: IconName, badge: BadgeTone, meaning: string): ProvenanceMeta => ({
  label,
  icon,
  badge,
  tone: BADGE_TONES[badge].soft,
  colours: BADGE_TONES[badge].colours,
  meaning,
});

// Computed and Module record are both plain facts, so they share the neutral tone and differ by icon and label.
export const PROVENANCE: Record<ProvenanceKind, ProvenanceMeta> = {
  ai: define(
    'AI-written',
    'sparkle',
    'ai',
    'Words from an AI agent, always built on facts the code worked out. It cannot change a number. Offline, its template stands in.',
  ),
  code: define('Computed', 'code', 'neutral', 'Worked out by code from your profile and the module records: the same answer every time.'),
  quote: define('Your words', 'chat', 'brand', 'Your own words from the interview, quoted as evidence.'),
  record: define('Module record', 'grid', 'neutral', 'A field from the module’s published record.'),
};

const ORDER: readonly ProvenanceKind[] = ['ai', 'code', 'quote', 'record'];

/** The chip's classes, for controls that must look like a Provenance chip (for example a popover trigger). */
export const provenanceClass = (kind: ProvenanceKind) => badgeClass({ tone: PROVENANCE[kind].badge });

interface ProvenanceProps {
  kind: ProvenanceKind;
  /** A more specific label for the same kind, for example "AI draft". */
  label?: string;
  className?: string;
}

export function Provenance({ kind, label, className }: ProvenanceProps) {
  const meta = PROVENANCE[kind];
  return (
    <Badge tone={meta.badge} icon={meta.icon} title={meta.meaning} className={className}>
      {label ?? meta.label}
    </Badge>
  );
}

/** The legend panel's width, and the gap it keeps from the edges of the window. */
const PANEL_WIDTH = 288;
const EDGE = 16;

/**
 * Where the panel starts, relative to its button, so it stays inside the window: under the button where it fits,
 * otherwise shifted left until it does, and never past the left edge.
 */
export function legendOffset(buttonLeft: number, viewportWidth: number): { left: number; width: number } {
  const width = Math.min(PANEL_WIDTH, viewportWidth - 2 * EDGE);
  const overflow = buttonLeft + width - (viewportWidth - EDGE);
  const left = overflow > 0 ? -overflow : 0;
  return { left: Math.max(left, EDGE - buttonLeft), width };
}

/** The smallest height the panel is given, so a cramped view still shows a scrollable panel rather than a sliver. */
const MIN_PANEL_HEIGHT = 120;

/**
 * Height left under the button before the window, or a clipping container around it (such as the advisor window,
 * which hides its overflow), cuts the panel off. The panel scrolls within it.
 */
export function roomBelow(button: HTMLElement): number {
  let bottom = window.innerHeight;
  // The page itself is bounded by the window; only containers inside it can clip sooner.
  for (let node = button.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).overflowY !== 'visible') bottom = Math.min(bottom, node.getBoundingClientRect().bottom);
  }
  return Math.max(MIN_PANEL_HEIGHT, bottom - button.getBoundingClientRect().bottom - 8 - EDGE);
}

/**
 * "How to read these": the four chips and what each means, in a small popover. Opens below its button, kept inside
 * the window; closes on Escape (focus returns to the button) or a click outside.
 */
export function ProvenanceLegend({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'on-brand' }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; width: number; maxHeight?: number }>({ left: 0, width: PANEL_WIDTH });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const toggle = () => {
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      setPlace({ ...legendOffset(rect.left, window.innerWidth), maxHeight: roomBelow(button) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    // Escape closes the legend only: caught before anything else sees it, so the drawer or dialog around the legend
    // (the advisor, the compare drawer) stays open.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className={cx('relative inline-flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cx(
          'inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-2xs font-semibold underline-offset-2 hover:underline',
          tone === 'on-brand' ? 'text-on-brand' : 'text-muted hover:text-ink',
        )}
      >
        <Icon name="info" size={12} />
        How to read these
      </button>
      <span
        id={panelId}
        role="dialog"
        aria-label="How to read these labels"
        hidden={!open}
        style={place}
        className="animate-rise absolute top-full z-30 mt-2 block overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-3 text-left text-ink shadow-lift"
      >
        <span className="block text-2xs font-semibold tracking-wide text-muted uppercase">Numbers from code, words from the AI</span>
        <span className="mt-2 grid gap-2">
          {ORDER.map((kind) => (
            <span key={kind} className="grid gap-1">
              <Provenance kind={kind} className="justify-self-start" />
              <span className="text-2xs leading-snug text-muted">{PROVENANCE[kind].meaning}</span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
