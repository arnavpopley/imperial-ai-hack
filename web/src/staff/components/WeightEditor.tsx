// Weight sliders for the tag editor: one row per key, with add and remove for taxonomy-backed maps.
import { useId, useState } from 'react';
import { focusRing, weight } from '../lib/format.ts';
import { PlusIcon, XIcon } from './icons.tsx';
import { Button } from './ui.tsx';

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
  const id = useId();
  const changed = original === null || Math.abs(original - value) > 1e-6;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7.5rem]">
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="block truncate font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={weight(value)}
          className={`h-2 min-w-0 flex-1 cursor-pointer accent-brand ${focusRing} rounded-full`}
        />
        <output htmlFor={id} className="w-10 text-right text-sm tabular-nums">
          {weight(value)}
        </output>
      </div>
      <div className="row-start-1 col-start-2 flex items-center justify-end gap-1 sm:row-auto sm:col-auto">
        {changed && (
          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-2xs font-medium text-brand">
            {original === null ? 'new' : `was ${weight(original)}`}
          </span>
        )}
        {onRemove && (
          <Button variant="ghost" onClick={onRemove} aria-label={`Remove ${label}`} className="px-1.5">
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
          <select
            id={selectId}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            className={`min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm sm:max-w-xs ${focusRing}`}
          >
            <option value="">Add a {noun}…</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Button onClick={add} disabled={!adding}>
            <PlusIcon />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
