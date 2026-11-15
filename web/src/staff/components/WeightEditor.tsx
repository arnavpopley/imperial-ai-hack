// Weight sliders for the tag editor: one row per key, with add and remove for taxonomy-backed maps.
import { useId, useState } from 'react';
import { RangeSlider } from '../../components/RangeSlider.tsx';
import { focusRing, weight } from '../lib/format.ts';
import { PlusIcon, XIcon } from './icons.tsx';
import { Button } from '../../components/Button.tsx';
import { Select } from '../../components/Select.tsx';

/** Starting weight for a newly added key, matching the counterfactual "add a topic at 0.3" (spec 9.3). */
const NEW_WEIGHT = 0.3;

export interface Option {
  id: string;
  label: string;
}

export function WeightSlider({
  label,
  hint,
  value,
  original,
  onChange,
  onRemove,
}: {
  label: string;
  hint?: string;
  value: number;
  /** The saved value, or null when this key is new in the draft. */
  original: number | null;
  onChange: (value: number) => void;
  onRemove?: () => void;
}) {
  const changed = original === null || Math.abs(original - value) > 1e-6;
  const delta = original === null ? null : value - original;
  return (
    // The shared slider stacks its label above a full-width track, so the track keeps its width in a narrow card
    // (issue #140). The change chip and remove button sit beside the track.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
      <RangeSlider
        label={label}
        hint={hint}
        value={value}
        onChange={onChange}
        valueText={weight(value)}
        ariaValueText={changed ? `${weight(value)}, ${original === null ? 'new' : `was ${weight(original)}`}` : weight(value)}
        marker={changed && original !== null ? original : undefined}
      />
      {/* A fixed width, so the track never shifts under the pointer when the change chip appears mid-drag. */}
      <div className="flex min-h-11 w-20 items-center justify-end gap-1 pt-4">
        {changed && (
          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-2xs font-medium text-brand tabular-nums" aria-hidden="true">
            {delta === null ? 'new' : `${delta > 0 ? '+' : delta < 0 ? '\u2212' : ''}${weight(Math.abs(delta))}`}
          </span>
        )}
        {onRemove && (
          <Button variant="ghost" onClick={onRemove} aria-label={`Remove ${label}`} className="min-h-8 px-1.5">
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

export function WeightMapEditor({
  value,
  original,
  options,
  labelFor,
  noun,
  onChange,
}: {
  value: Record<string, number>;
  original: Record<string, number>;
  /** Keys that may be added. Only these are offered, so the server never sees an unknown key. */
  options: readonly Option[];
  labelFor: (id: string) => string;
  noun: string;
  onChange: (next: Record<string, number>) => void;
}) {
  const selectId = useId();
  const [adding, setAdding] = useState('');
  const available = options.filter((o) => !(o.id in value));
  // Order by the saved weight so rows never jump while a slider is being dragged; new keys go last.
  const entries = Object.entries(value).sort(
    ([a], [b]) => (original[b] ?? -1) - (original[a] ?? -1) || labelFor(a).localeCompare(labelFor(b)),
  );

  const add = () => {
    if (!adding) return;
    onChange({ ...value, [adding]: NEW_WEIGHT });
    setAdding('');
  };

  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No {noun}s tagged yet.</p>
      ) : (
        entries.map(([key, v]) => (
          <WeightSlider
            key={key}
            label={labelFor(key)}
            value={v}
            original={original[key] ?? null}
            onChange={(next) => onChange({ ...value, [key]: next })}
            onRemove={() => remove(key)}
          />
        ))
      )}
      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
          <label htmlFor={selectId} className="sr-only">
            Add a {noun}
          </label>
          <Select
            id={selectId}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            wrapperClassName="flex-1 sm:max-w-xs"
          >
            <option value="">Add a {noun}…</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button onClick={add} disabled={!adding}>
            <PlusIcon />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
