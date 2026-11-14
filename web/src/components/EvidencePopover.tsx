// Links a "because" reason to its source: the student's own quote, or the module record field.
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface QuoteProps {
  variant: 'quote';
  quote: string;
  /** What the quote was evidence for, for example "Interest: Fluid mechanics". */
  slotLabel: string;
  confidence: number;
}

interface ModuleFieldProps {
  variant: 'module-field';
  /** Human label for the field, for example "Topic weight: Fluid mechanics". */
  fieldLabel: string;
  value: string;
}

interface MissingProps {
  /** The cited evidence is not available, for example after the profile was edited. */
  variant: 'missing';
}

export type EvidencePopoverProps = (QuoteProps | ModuleFieldProps | MissingProps) & { className?: string };

const triggerText = { quote: 'Your words', 'module-field': 'Module record', missing: 'Source' } as const;

/**
 * Place inside a positioned container (for example the reason's list item): the panel opens below it,
 * spanning the container on phones and 20rem wide from the left edge on larger screens.
 */
export function EvidencePopover(props: EvidencePopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = `${panelId}-title`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className={cx('inline', props.className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'inline-flex h-6 items-center gap-1 rounded-full px-2 align-middle text-[11px] font-semibold transition',
          props.variant === 'quote' && 'bg-brand-soft text-brand hover:bg-brand/15',
          props.variant === 'module-field' && 'bg-surface-2 text-ink ring-1 ring-line ring-inset hover:bg-line',
          props.variant === 'missing' && 'bg-surface-2 text-muted',
          open && 'ring-2 ring-brand/40',
        )}
      >
        <Icon name={props.variant === 'quote' ? 'chat' : 'grid'} size={11} />
        {triggerText[props.variant]}
        <Icon name="chevron-down" size={11} className={cx('transition', open && 'rotate-180')} />
      </button>
      <span
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        className="animate-rise absolute inset-x-0 top-full z-30 mt-2 block rounded-xl border border-line bg-surface p-4 text-left shadow-lift sm:left-auto sm:w-80"
      >
        <PanelBody {...props} titleId={titleId} />
      </span>
    </span>
  );
}

function PanelBody(props: EvidencePopoverProps & { titleId: string }) {
  if (props.variant === 'quote') {
    return (
      <>
        <span id={props.titleId} className="block text-[11px] font-semibold tracking-wide text-muted uppercase">
          In your words
        </span>
        <q className="mt-1.5 block text-[15px] leading-snug font-medium text-ink before:text-brand after:text-brand">
          {props.quote}
        </q>
        <span className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted">
          <span>{props.slotLabel}</span>
          <span className="tabular-nums">Extractor confidence {Math.round(props.confidence * 100)}%</span>
        </span>
      </>
    );
  }
  if (props.variant === 'module-field') {
    return (
      <>
        <span id={props.titleId} className="block text-[11px] font-semibold tracking-wide text-muted uppercase">
          From the module record
        </span>
        <span className="mt-1.5 block text-sm font-medium">{props.fieldLabel}</span>
        <span className="mt-1 block font-mono text-[13px] break-words text-muted">{props.value}</span>
      </>
    );
  }
  return (
    <span id={props.titleId} className="block text-[13px] text-muted">
      The source for this reason is no longer available.
    </span>
  );
}
