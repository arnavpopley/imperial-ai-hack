// Spec 10.2 question 5: maths and coding comfort are two inline sliders, not typed answers.
// Each slider sits on its own card with the level in large type, so the answer reads at a glance.
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button.tsx';
import { humanise, isStyleKey, percent, STYLE_META, styleValueText } from '../labels.ts';

/** Used when the widget arrives without fields. The server sends bare style keys. */
const DEFAULT_FIELDS = ['mathsComfort', 'codingComfort'] as const;

/** A glyph per known field, so the two cards are easy to tell apart. */
const GLYPHS: Record<string, string> = { mathsComfort: '∑', codingComfort: '</>' };

/** Accepts "style.mathsComfort" or "mathsComfort" and returns display labels for it. */
function fieldMeta(field: string): {
  key: string;
  label: string;
  low: string;
  high: string;
  level: (v: number) => string;
} {
  const key = field.startsWith('style.') ? field.slice('style.'.length) : field;
  if (isStyleKey(key)) return { key, ...STYLE_META[key], level: (v) => styleValueText(key, v) };
  return { key, label: humanise(key), low: 'Low', high: 'High', level: percent };
}

interface InlineSlidersProps {
  /** Slot names from the `done` widget. Structured answers are keyed by these exact names. */
  fields: readonly string[];
  disabled: boolean;
  onSubmit: (content: string, structured: Record<string, number>) => void;
}

export function InlineSliders({ fields, disabled, onSubmit }: InlineSlidersProps) {
  const list = fields.length > 0 ? fields : DEFAULT_FIELDS;
  const formId = useId();
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(list.map((f) => [f, 0.5])));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = list.map((f) => `${fieldMeta(f).label}: ${percent(values[f] ?? 0.5)}`).join('. ');
    onSubmit(`${content}.`, values);
  };

  return (
    <form onSubmit={submit} aria-label="Answer with sliders" className="grid gap-4 sm:pl-14">
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((field) => {
          const meta = fieldMeta(field);
          const value = values[field] ?? 0.5;
          const level = meta.level(value);
          const inputId = `${formId}-${meta.key}`;
          return (
            <div key={field} className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft font-mono text-[15px] font-semibold text-brand"
                >
                  {GLYPHS[meta.key] ?? meta.label.charAt(0)}
                </span>
                <div className="min-w-0">
                  <label htmlFor={inputId} className="block text-[13px] text-muted">
                    {meta.label}
                  </label>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={level}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="text-lg font-semibold tracking-tight"
                      aria-hidden="true"
                    >
                      {level}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <BigSlider
                id={inputId}
                value={value}
                valueText={`${level}, ${percent(value)}`}
                low={meta.low}
                high={meta.high}
                onChange={(v) => setValues((current) => ({ ...current, [field]: v }))}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" icon="send" disabled={disabled}>
          Send answer
        </Button>
      </div>
    </form>
  );
}

/**
 * A large 0-1 slider. The native range input stays in place (invisible) for keyboard, pointer and
 * screen-reader support; the card's label names it, so it shows no label of its own.
 */
function BigSlider({
  id,
  value,
  valueText,
  low,
  high,
  onChange,
}: {
  id: string;
  value: number;
  valueText: string;
  low: string;
  high: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="relative h-8">
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          aria-valuetext={valueText}
          onChange={(event) => onChange(Number(event.target.value))}
          className="peer absolute inset-0 z-10 m-0 w-full cursor-pointer opacity-0"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand" style={{ width: `${value * 100}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-brand bg-surface shadow-lift transition-shadow peer-focus-visible:ring-4 peer-focus-visible:ring-brand/30"
          style={{ left: `calc(12px + (100% - 24px) * ${value})` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-[12px] text-muted" aria-hidden="true">
        <span>{low}</span>
        <span className="text-right">{high}</span>
      </div>
    </div>
  );
}
