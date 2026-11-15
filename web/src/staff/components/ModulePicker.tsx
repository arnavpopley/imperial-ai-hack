// Searchable, sortable module list for the module-lead dashboard. It leads with the modules the cohort can
// choose, grouped by how its programme year offers them (issue #69).
import { MIN_COHORT } from '@modulematch/shared';
import type { StaffModuleSummary } from '@modulematch/shared';
import { useId, useMemo, useState } from 'react';
import { NavLink, useMatch } from 'react-router';
import { CAPACITY_LABEL, capacityStatus, focusRing, percent } from '../lib/format.ts';
import {
  GOOD_FIT,
  VIEWS,
  groupRows,
  hasOffers,
  inView,
  isOption,
  shortlistFigure,
  shortlistLabel,
  goodFitShare,
} from '../lib/moduleList.ts';
import type { ListView } from '../lib/moduleList.ts';
import { byCohortFigure, isCohortVisible } from '../lib/privacy.ts';
import { DemandMiniBar } from './DemandGauge.tsx';
import { SearchIcon, ShieldIcon } from './icons.tsx';
import { Segmented } from './ui.tsx';

const SORTS = {
  strong: { label: `Good fit or better (${GOOD_FIT}+)`, compare: byCohortFigure(goodFitShare) },
  fit: { label: 'Average fit', compare: byCohortFigure((m) => m.averageFit) },
  shortlisted: { label: 'Shortlisted', compare: byCohortFigure(shortlistFigure) },
  pressure: { label: 'Demand against capacity', compare: byCohortFigure(load) },
  code: { label: 'Module code', compare: (a, b) => a.code.localeCompare(b.code) },
} satisfies Record<string, { label: string; compare: (a: StaffModuleSummary, b: StaffModuleSummary) => number }>;

type SortKey = keyof typeof SORTS;

/** Share of capacity taken; uncapped modules, and counts under MIN_COHORT, sort last. */
function load(m: StaffModuleSummary): number {
  return m.capacity === null ? -1 : shortlistFigure(m) / m.capacity;
}

const isSortKey = (v: string): v is SortKey => Object.hasOwn(SORTS, v);

/** The module the console opens on: the strongest fit among the options the cohort can choose. */
export function firstModule(modules: readonly StaffModuleSummary[]): StaffModuleSummary | undefined {
  const options = modules.filter(isOption);
  return [...(options.length > 0 ? options : modules)].sort(SORTS.strong.compare)[0];
}

export function ModulePicker({ modules }: { modules: StaffModuleSummary[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('strong');
  // Start on the options, unless the open module is not one: then show everything so it stays in the list.
  const openId = useMatch('/staff/modules/:moduleId/*')?.params.moduleId;
  const [view, setView] = useState<ListView>(() => {
    const open = modules.find((m) => m.moduleId === openId);
    return open && !inView(open, 'options') ? 'all' : 'options';
  });
  const searchId = useId();
  const sortId = useId();
  const grouped = hasOffers(modules);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modules
      .filter((m) => !q || m.title.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      .filter((m) => inView(m, view))
      .sort(SORTS[sort].compare);
  }, [modules, query, sort, view]);
  const groups = groupRows(visible);

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
        {grouped && (
          <Segmented
            legend="Show"
            name={`${searchId}-view`}
            value={view}
            onChange={setView}
            options={VIEWS.map((v) => ({ value: v.value, label: v.label, count: modules.filter((m) => inView(m, v.value)).length }))}
          />
        )}
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
        <p className="text-xs text-muted">
          % = share of the cohort with a good fit or better ({GOOD_FIT}+) · bars = fit spread, 0 to 100
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {visible.length} of {modules.length} modules shown
      </p>
      {visible.length === 0 ? (
        <p className="p-4 text-sm text-muted">
          {query.trim() ? `No modules match “${query}” in this view.` : 'No modules in this view.'}
        </p>
      ) : (
        // scroll-pt keeps a row scrolled into view clear of its sticky group heading.
        <div className="max-h-80 scroll-pt-10 overflow-x-hidden overflow-y-auto overscroll-contain p-2 lg:max-h-[calc(100dvh-18rem)]">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="grid gap-1">
              {(grouped || groups.length > 1) && (
                <h3 className="sticky top-0 z-[1] flex items-baseline justify-between bg-surface/95 px-3.5 pt-3 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase backdrop-blur">
                  {group.label}
                  <span className="font-normal tabular-nums">{group.rows.length}</span>
                </h3>
              )}
              <ul className="grid gap-1">
                {group.rows.map((m) => (
                  <li key={m.moduleId}>
                    <NavLink
                      to={`/staff/modules/${encodeURIComponent(m.moduleId)}`}
                      className={({ isActive }) =>
                        `grid min-w-0 gap-2 rounded-2xl px-3.5 py-3 transition-colors ${
                          isActive ? 'bg-brand-soft ring-1 ring-brand/30' : 'hover:bg-canvas'
                        } ${focusRing}`
                      }
                    >
                      {!isCohortVisible(m) ? (
                        <HiddenFigures module={m} />
                      ) : m.offer === 'not-offered' ? (
                        <NotOffered module={m} />
                      ) : (
                        <ModuleFigures module={m} />
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </nav>
  );
}

/** The cohort's fit spread in ten buckets; good-fit buckets are tinted. Decorative beside the figures. */
function FitSpark({ histogram }: { histogram: readonly number[] }) {
  const max = Math.max(1, ...histogram);
  return (
    <span aria-hidden="true" className="flex h-5 w-20 shrink-0 items-end gap-px" title="Fit spread, 0 to 100">
      {histogram.map((n, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-[2px] ${i * 10 >= GOOD_FIT ? 'bg-fit-high' : 'bg-line-strong'}`}
          style={{ height: `${Math.max(n > 0 ? 12 : 4, (n / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function ModuleFigures({ module: m }: { module: StaffModuleSummary }) {
  const status = capacityStatus(m.shortlisted, m.capacity);
  const share = goodFitShare(m);
  const counted = isOption(m) && m.shortlisted >= MIN_COHORT;
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm leading-snug font-medium break-words text-pretty">{m.title}</span>
        <span
          aria-hidden="true"
          className={`grid h-7 min-w-11 shrink-0 place-items-center rounded-full px-2 text-xs font-semibold tabular-nums ring-1 ${
            share > 0 ? 'bg-fit-high/10 text-fit-high ring-fit-high/30' : 'bg-surface text-muted ring-line'
          }`}
          title={`Share of the cohort with a fit of ${GOOD_FIT} or more`}
        >
          {percent(share)}
        </span>
      </span>
      <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span className="flex items-end gap-2.5">
          <span className="font-mono">{m.code}</span>
          <FitSpark histogram={m.fitHistogram} />
        </span>
        <span className="tabular-nums">
          {shortlistLabel(m)}
          {/* The student chip's words; the separator keeps them apart from the count for screen readers too. */}
          {counted && (status === 'over' || status === 'near') && (
            <span className={`font-medium ${status === 'over' ? 'text-fit-low' : 'text-fit-mid'}`}>
              {' · '}
              {CAPACITY_LABEL[status].toLowerCase()}
            </span>
          )}
        </span>
      </span>
      {counted && <DemandMiniBar shortlisted={m.shortlisted} capacity={m.capacity} />}
      <span className="sr-only">
        {/* Starts a new sentence, so it never runs on from the shortlist words before it. */}
        {'. '}
        {percent(share)} of the cohort with a fit of {GOOD_FIT} or more; average fit {Math.round(m.averageFit)}.
      </span>
    </>
  );
}

/** Students in this cohort cannot take the module, so its fit and demand would only mislead. */
function NotOffered({ module: m }: { module: StaffModuleSummary }) {
  return (
    <>
      <span className="min-w-0 text-sm leading-snug font-medium break-words text-pretty text-muted">{m.title}</span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className="font-mono">{m.code}</span>
        <span>{shortlistLabel(m)}</span>
      </span>
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
