// Spec 10.2 question 5: maths and coding comfort are two inline sliders, not typed answers.
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button.tsx';
import { RangeSlider } from '../../components/RangeSlider.tsx';
import { humanise, isStyleKey, percent, STYLE_META } from '../labels.ts';

/** Used when the widget arrives without fields. The server sends bare style keys. */
const DEFAULT_FIELDS = ['mathsComfort', 'codingComfort'] as const;

/** Accepts "style.mathsComfort" or "mathsComfort" and returns display labels for it. */
function fieldMeta(field: string): { label: string; low: string; high: string } {
  const key = field.startsWith('style.') ? field.slice('style.'.length) : field;
  return isStyleKey(key) ? STYLE_META[key] : { label: humanise(key), low: 'Low', high: 'High' };
}

interface InlineSlidersProps {
  /** Slot names from the `done` widget. Structured answers are keyed by these exact names. */
  fields: readonly string[];
  disabled: boolean;
  onSubmit: (content: string, structured: Record<string, number>) => void;
}

export function InlineSliders({ fields, disabled, onSubmit }: InlineSlidersProps) {
  const list = fields.length > 0 ? fields : DEFAULT_FIELDS;
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(list.map((f) => [f, 0.5])),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = list.map((f) => `${fieldMeta(f).label}: ${percent(values[f] ?? 0.5)}`).join('. ');
    onSubmit(`${content}.`, values);
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Answer with sliders"
      className="animate-rise grid gap-4 rounded-card border border-line bg-surface p-4 shadow-soft"
    >
      {list.map((field) => {
        const meta = fieldMeta(field);
        const value = values[field] ?? 0.5;
        return (
          <RangeSlider
            key={field}
            label={meta.label}
            value={value}
            valueText={percent(value)}
            lowLabel={meta.low}
            highLabel={meta.high}
            onChange={(v) => setValues((current) => ({ ...current, [field]: v }))}
          />
        );
      })}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" icon="send" disabled={disabled}>
          Send answer
        </Button>
      </div>
    </form>
  );
}
