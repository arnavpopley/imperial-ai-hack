// Searchable, sortable module list for the module-lead dashboard.
import type { StaffModuleSummary } from '@modulematch/shared';
import { useId, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { capacityStatus, focusRing } from '../lib/format.ts';
import { DemandMiniBar } from './DemandGauge.tsx';
import { SearchIcon } from './icons.tsx';

const SORTS = {
  fit: { label: 'Average fit', compare: (a, b) => b.averageFit - a.averageFit },
  shortlisted: { label: 'Shortlisted', compare: (a, b) => b.shortlisted - a.shortlisted },
  pressure: {
    label: 'Demand against capacity',
    compare: (a, b) => load(b) - load(a),
  },
  code: { label: 'Module code', compare: (a, b) => a.code.localeCompare(b.code) },
} satisfies Record<string, { label: string; compare: (a: StaffModuleSummary, b: StaffModuleSummary) => number }>;

type SortKey = keyof typeof SORTS;

/** Share of capacity taken; uncapped modules sort last. */
function load(m: StaffModuleSummary): number {
  return m.capacity === null ? -1 : m.shortlisted / m.capacity;
}

const isSortKey = (v: string): v is SortKey => Object.hasOwn(SORTS, v);

export function ModulePicker({ modules }: { modules: StaffModuleSummary[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('fit');
  const searchId = useId();
  const sortId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modules
      .filter((m) => !q || m.title.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      .sort(SORTS[sort].compare);
  }, [modules, query, sort]);

  return (
    <nav aria-label="Modules" className="flex min-h-0 flex-col rounded-card border border-line bg-surface">
      <div className="grid gap-2 border-b border-line p-3">
        <label htmlFor={searchId} className="sr-only">
          Search modules
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or code"
            className={`w-full rounded-lg border border-line bg-canvas py-1.5 pr-2 pl-8 text-sm placeholder:text-muted ${focusRing}`}
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor={sortId} className="text-muted">
            Sort by
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => isSortKey(e.target.value) && setSort(e.target.value)}
            className={`min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 py-1 text-xs ${focusRing}`}
          >
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {visible.length} of {modules.length} modules shown
      </p>
      {visible.length === 0 ? (
        <p className="p-4 text-sm text-muted">No modules match “{query}”.</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto p-1.5 lg:max-h-[calc(100dvh-16rem)]">
          {visible.map((m) => {
            const status = capacityStatus(m.shortlisted, m.capacity);
            return (
              <li key={m.moduleId}>
                <NavLink
                  to={`/staff/modules/${encodeURIComponent(m.moduleId)}`}
                  className={({ isActive }) =>
                    `grid gap-1.5 rounded-lg px-2.5 py-2 transition-colors ${
                      isActive ? 'bg-brand-soft' : 'hover:bg-canvas'
                    } ${focusRing}`
                  }
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{m.title}</span>
                    <span aria-hidden="true" className="shrink-0 text-sm font-semibold tabular-nums" title="Average fit">
                      {Math.round(m.averageFit)}
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2 text-xs text-muted">
                    <span className="font-mono">{m.code}</span>
                    <span className="tabular-nums">
                      {m.shortlisted}
                      {m.capacity !== null && ` / ${m.capacity}`} shortlisted
                      {status === 'over' && <span className="ml-1 font-medium text-fit-low">over</span>}
                      {status === 'near' && <span className="ml-1 font-medium text-fit-mid">near cap</span>}
                    </span>
                  </span>
                  <DemandMiniBar shortlisted={m.shortlisted} capacity={m.capacity} />
                  <span className="sr-only">Average fit {Math.round(m.averageFit)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
