// The changes a staff edit will make, shown before it is saved.
import type { Change, DraftDiff } from '../lib/derivedDraft.ts';
import { weight } from '../lib/format.ts';

const GROUPS: { field: keyof DraftDiff; title: string }[] = [
  { field: 'topics', title: 'Topics' },
  { field: 'skills', title: 'Skills' },
  { field: 'pathwayRelevance', title: 'Pathway relevance' },
  { field: 'demand', title: 'Demand profile' },
];

function ChangeRow({ change, label }: { change: Change; label: string }) {
  if (change.before === null)
    return (
      <li className="flex items-baseline gap-2">
        <span aria-hidden="true" className="w-3 font-mono text-fit-high">+</span>
        <span className="min-w-0 flex-1">
          <span className="sr-only">Added </span>
          {label}
        </span>
        <span className="tabular-nums">{weight(change.after ?? 0)}</span>
      </li>
    );
  if (change.after === null)
    return (
      <li className="flex items-baseline gap-2 text-muted">
        <span aria-hidden="true" className="w-3 font-mono text-fit-low">−</span>
        <span className="min-w-0 flex-1 line-through">
          <span className="sr-only">Removed </span>
          {label}
        </span>
        <span className="tabular-nums">{weight(change.before)}</span>
      </li>
    );
  return (
    <li className="flex items-baseline gap-2">
      <span aria-hidden="true" className="w-3 font-mono text-brand">~</span>
      <span className="min-w-0 flex-1">{label}</span>
      <span className="tabular-nums">
        <span className="text-muted">{weight(change.before)}</span>
        <span aria-hidden="true"> → </span>
        <span className="sr-only"> changed to </span>
        {weight(change.after)}
      </span>
    </li>
  );
}

export function DiffSummary({ diff, labelFor }: { diff: DraftDiff; labelFor: (field: keyof DraftDiff, key: string) => string }) {
  const groups = GROUPS.filter((g) => diff[g.field].length > 0);
  if (groups.length === 0) return <p className="text-sm text-muted">No changes yet. Move a slider to start.</p>;
  return (
    <div className="grid gap-3 text-sm">
      {groups.map((g) => (
        <div key={g.field}>
          <h3 className="mb-1 text-xs font-medium text-muted">{g.title}</h3>
          <ul className="grid gap-0.5">
            {diff[g.field].map((c) => (
              <ChangeRow key={c.key} change={c} label={labelFor(g.field, c.key)} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
