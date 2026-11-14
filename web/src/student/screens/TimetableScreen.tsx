// Screen 5: weekly grid per term with clashes highlighted, swaps beside each clash, and the
// programme rules result (spec 9.1, 9.2).
import type { SwapSuggestion, Term, TimetableView } from '@modulematch/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.ts';
import { buttonClass } from '../../components/Button.tsx';
import { ClashMarker } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useShortlist } from '../hooks/useShortlist.ts';
import { TERM_LABELS } from '../labels.ts';
import { paths } from '../routes.ts';
import { useAdvisor } from '../shell/StudentShell.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { ClashCard } from '../timetable/ClashCard.tsx';
import { moduleColours } from '../timetable/moduleColours.ts';
import { WeekGrid } from '../timetable/WeekGrid.tsx';

export function TimetableScreen() {
  const { session } = useReadySession();
  const sessionId = session.id;
  const shortlistKey = session.shortlist.join(',');
  const timetable = useAsync(() => api.timetable(sessionId), [sessionId, shortlistKey]);

  return (
    <div className="grid grid-cols-1 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your timetable</h1>
          <p className="mt-1 text-sm text-muted">A mock week built from your shortlist, with clashes caught before you commit.</p>
        </div>
        <SampleDataLabel variant="synthetic" />
      </header>

      {session.shortlist.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Shortlist a few modules to see your week"
          action={
            <Link to={paths.catalogue} className={buttonClass('primary', 'sm')}>
              Browse your modules
            </Link>
          }
        >
          Your timetable, clashes and programme rules check appear here.
        </EmptyState>
      ) : timetable.data ? (
        <TimetableBody view={timetable.data} onChanged={timetable.reload} refreshing={timetable.loading} />
      ) : timetable.error ? (
        <ErrorState message={timetable.error} onRetry={timetable.reload} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]" role="status" aria-label="Building your timetable">
          <Skeleton className="h-[36rem]" />
          <Skeleton className="h-64" />
        </div>
      )}
    </div>
  );
}

function TimetableBody({ view, onChanged, refreshing }: { view: TimetableView; onChanged: () => void; refreshing: boolean }) {
  const { session } = useReadySession();
  const { moduleById } = useReferenceData();
  const { openAdvisor } = useAdvisor();
  const shortlist = useShortlist();
  const terms = view.grids.map((g) => g.term);
  const defaultTerm =
    view.grids.find((g) => view.clashes.some((c) => c.term === g.term))?.term ??
    view.grids.find((g) => g.slots.length > 0)?.term ??
    terms[0];
  const [chosen, setChosen] = useState<Term | undefined>(defaultTerm);
  const term = chosen && terms.includes(chosen) ? chosen : defaultTerm;
  const grid = view.grids.find((g) => g.term === term);

  const allModuleIds = [...session.shortlist, ...view.grids.flatMap((g) => g.slots.map((s) => s.moduleId))];
  const colourFor = moduleColours(allModuleIds);
  const titleFor = (id: string) => moduleById.get(id)?.title ?? id;
  const codeFor = (id: string) => moduleById.get(id)?.code ?? id;
  const ects = session.shortlist.reduce((sum, id) => sum + (moduleById.get(id)?.ects ?? 0), 0);

  const swap = async (s: SwapSuggestion) => {
    await shortlist.swap(s.replaceModuleId, s.withModuleId);
    onChanged();
  };

  const termOptions = terms.map((t) => {
    const count = view.clashes.filter((c) => c.term === t).length;
    return { value: t, label: count > 0 ? `${TERM_LABELS[t]} · ${count} clash${count > 1 ? 'es' : ''}` : TERM_LABELS[t] };
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <section aria-label="Week view" className="min-w-0 rounded-[1.25rem] border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {term && termOptions.length > 0 ? (
            <SegmentedControl legend="Term" hideLegend options={termOptions} value={term} onChange={setChosen} />
          ) : (
            <span />
          )}
          <Legend />
        </div>
        {grid && grid.slots.length > 0 && term ? (
          <WeekGrid
            term={term}
            slots={grid.slots}
            clashes={view.clashes}
            colourFor={colourFor}
            codeFor={codeFor}
            titleFor={titleFor}
          />
        ) : (
          <EmptyState icon="calendar" title={`Nothing scheduled${term ? ` in ${TERM_LABELS[term].toLowerCase()}` : ''}`}>
            None of your shortlisted modules teach in this term.
          </EmptyState>
        )}
        {refreshing && <p className="mt-2 text-[12px] text-muted">Updating…</p>}
      </section>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <section aria-labelledby="clash-heading">
          <h2 id="clash-heading" className="mb-2 text-sm font-semibold">
            {view.clashes.length === 0 ? 'No clashes' : `${view.clashes.length} clash${view.clashes.length > 1 ? 'es' : ''} to resolve`}
          </h2>
          {view.clashes.length === 0 ? (
            <p className="flex items-center gap-2 rounded-card border border-fit-high/30 bg-fit-high/6 px-4 py-3 text-[13px]">
              <Icon name="check" size={15} className="text-fit-high" />
              Your shortlist fits together in every term.
            </p>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {view.clashes.map((clash) => (
                <ClashCard
                  key={`${clash.moduleA}-${clash.moduleB}-${clash.term}`}
                  clash={clash}
                  swaps={view.swaps.filter((s) => s.replaceModuleId === clash.moduleA || s.replaceModuleId === clash.moduleB)}
                  titleFor={titleFor}
                  onSwap={swap}
                  onAsk={openAdvisor}
                />
              ))}
            </ul>
          )}
        </section>

        <RulesPanel view={view} />

        <section aria-labelledby="shortlist-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="shortlist-heading" className="text-sm font-semibold">
              Shortlist
            </h2>
            <span className="text-[12px] text-muted tabular-nums">{ects} ECTS</span>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {session.shortlist.map((id) => (
              <li key={id} className="flex items-center gap-2.5 rounded-lg py-1 text-[13px]">
                <span className={cx('size-2.5 shrink-0 rounded-full', colourFor(id).dot)} aria-hidden="true" />
                <Link to={paths.module(id)} className="min-w-0 flex-1 truncate font-medium hover:text-brand">
                  {titleFor(id)}
                </Link>
                <button
                  type="button"
                  onClick={() => void shortlist.toggle(id)}
                  disabled={shortlist.isPending(id)}
                  className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fit-low disabled:opacity-50"
                >
                  <Icon name="x" size={14} label={`Remove ${titleFor(id)} from the shortlist`} />
                </button>
              </li>
            ))}
          </ul>
          {shortlist.error && (
            <p role="alert" className="mt-2 text-[13px] text-fit-low">
              {shortlist.error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-2 text-[11px] text-muted" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-line-strong" aria-hidden="true" />
        Provisional
      </li>
      <li>
        <ClashMarker variant="certain" />
      </li>
      <li>
        <ClashMarker variant="likely" />
      </li>
      <li>
        <ClashMarker variant="possible" />
      </li>
    </ul>
  );
}

function RulesPanel({ view }: { view: TimetableView }) {
  const { ok, violations, warnings } = view.rules;
  return (
    <section aria-labelledby="rules-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <h2 id="rules-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Icon name="shield" size={15} className={ok ? 'text-fit-high' : 'text-fit-low'} />
        Programme rules
      </h2>
      {ok && violations.length === 0 && (
        <p className="mt-1.5 text-[13px] text-muted">Your shortlist meets the rules for your programme and year.</p>
      )}
      {violations.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {violations.map((v) => (
            <li key={`${v.code}-${v.moduleId ?? ''}`} className="flex gap-2 rounded-lg bg-fit-low/8 px-3 py-2 text-[13px]">
              <Icon name="ban" size={14} className="mt-0.5 shrink-0 text-fit-low" />
              {v.message}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {warnings.map((w) => (
            <li key={w.code} className="flex gap-2 rounded-lg bg-fit-mid/10 px-3 py-2 text-[13px]">
              <Icon name="info" size={14} className="mt-0.5 shrink-0 text-fit-mid" />
              {w.message}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted">No agent can override a rule. Exceptions go to the Senior Tutor.</p>
    </section>
  );
}
