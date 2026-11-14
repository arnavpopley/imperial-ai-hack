// Searchable, sortable module list for the module-lead dashboard.
import { MIN_COHORT } from '@modulematch/shared';
import type { StaffModuleSummary } from '@modulematch/shared';
import { useId, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { capacityStatus, focusRing } from '../lib/format.ts';
import { byCohortFigure, isCohortVisible } from '../lib/privacy.ts';
import { DemandMiniBar } from './DemandGauge.tsx';
import { SearchIcon, ShieldIcon } from './icons.tsx';

const SORTS = {
  fit: { label: 'Average fit', compare: byCohortFigure((m) => m.averageFit) },
  shortlisted: { label: 'Shortlisted', compare: byCohortFigure((m) => m.shortlisted) },
  pressure: { label: 'Demand against capacity', compare: byCohortFigure(load) },
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
    <nav aria-label="Modules" className="flex min-h-0 flex-col overflow-hidden rounded-panel bg-surface shadow-soft ring-1 ring-line">
      <div className="grid gap-3 border-b border-line p-4">
        <label htmlFor={searchId} className="sr-only">
          Search modules
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or code"
            className={`w-full rounded-xl border border-line bg-canvas py-2.5 pr-3 pl-9 text-sm placeholder:text-muted ${focusRing}`}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={sortId} className="text-muted">
            Sort by
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => isSortKey(e.target.value) && setSort(e.target.value)}
            className={`min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm ${focusRing}`}
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
        <ul className="grid max-h-80 gap-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2 lg:max-h-[calc(100dvh-14rem)]">
          {visible.map((m) => (
            <li key={m.moduleId}>
              <NavLink
                to={`/staff/modules/${encodeURIComponent(m.moduleId)}`}
                className={({ isActive }) =>
                  `grid min-w-0 gap-2 rounded-2xl px-3.5 py-3 transition-colors ${
                    isActive ? 'bg-brand-soft ring-1 ring-brand/30' : 'hover:bg-canvas'
                  } ${focusRing}`
                }
              >
                {isCohortVisible(m) ? <ModuleFigures module={m} /> : <HiddenFigures module={m} />}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

function ModuleFigures({ module: m }: { module: StaffModuleSummary }) {
  const status = capacityStatus(m.shortlisted, m.capacity);
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm leading-snug font-medium break-words text-pretty">{m.title}</span>
        <span
          aria-hidden="true"
          className="grid h-7 min-w-9 shrink-0 place-items-center rounded-full bg-surface px-2 text-sm font-semibold tabular-nums ring-1 ring-line"
          title="Average fit"
        >
          {Math.round(m.averageFit)}
        </span>
      </span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted">
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
    </>
  );
}

/** A cohort under MIN_COHORT: the row names the module and withholds every figure. */
function HiddenFigures({ module: m }: { module: StaffModuleSummary }) {
  return (
    <>
      <span className="min-w-0 text-sm leading-snug font-medium break-words text-pretty">{m.title}</span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className="font-mono">{m.code}</span>
        <span className="inline-flex items-center gap-1">
          <ShieldIcon className="size-3.5" />
          Cohort under {MIN_COHORT}: hidden
        </span>
      </span>
    </>
  );
}
