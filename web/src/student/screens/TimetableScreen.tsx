// Screen 5: weekly grid per term with clashes highlighted, swaps beside each clash, and the
// programme rules result (spec 9.1, 9.2).
import { SWAP_FIT_TOLERANCE, type Clash, type SwapSuggestion, type Term, type TimetableView } from '@modulematch/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api.ts';
import { Button, buttonClass } from '../../components/Button.tsx';
import { ClashMarker } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { decisionsKey } from '../../components/exceptions.ts';
import { Icon } from '../../components/Icon.tsx';
import { GlanceStats, PageHeader } from '../../components/PageHeader.tsx';
import { Meter } from '../../components/Meter.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { downloadFile } from '../download.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useShortlist } from '../hooks/useShortlist.ts';
import { DAY_LABELS, keepFreeLabel, TERM_LABELS } from '../labels.ts';
import { paths } from '../routes.ts';
import { ectsLabels } from '../rulesStatus.ts';
import { useAdvisor } from '../shell/StudentShell.tsx';
import { useCatalogue } from '../state/CatalogueProvider.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { CapacityBackupPanel } from '../timetable/CapacityBackupPanel.tsx';
import { ClashCard } from '../timetable/ClashCard.tsx';
import { buildIcs } from '../timetable/exportPlan.ts';
import { PlanPrint } from '../timetable/PlanPrint.tsx';
import { moduleColours } from '../timetable/moduleColours.ts';
import { WeekGrid } from '../timetable/WeekGrid.tsx';

export function TimetableScreen() {
  const { session } = useReadySession();
  const sessionId = session.id;
  const shortlistKey = session.shortlist.join(',');
  // A Senior Tutor decision can change which swaps and rule violations apply, and kept-free time comes from the
  // profile, so either one refetches the view too.
  const decisions = decisionsKey(session);
  const timetable = useAsync(() => api.timetable(sessionId), [sessionId, shortlistKey, decisions, session.profile.updatedAt]);
  // Core modules are in the plan from the start, so the week shows even before any elective is shortlisted.
  const nothingToShow = session.shortlist.length === 0 && timetable.data?.coreModuleIds.length === 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Your timetable"
        subtitle="A mock week built from your shortlist, with clashes caught before you commit."
        label={<SampleDataLabel variant="synthetic" />}
        glance={timetable.data && !nothingToShow && <TimetableGlance view={timetable.data} />}
      />
      <ProvisionalNotice />

      {nothingToShow ? (
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
        <TimetableBody
          view={timetable.data}
          onChanged={timetable.reload}
          refreshing={timetable.loading}
          stale={timetable.loading || Boolean(timetable.error)}
        />
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

interface TimetableBodyProps {
  view: TimetableView;
  onChanged: () => void;
  refreshing: boolean;
  /** The view may not match the shortlist: a refresh is running or the last one failed. */
  stale: boolean;
}

function TimetableBody({ view, onChanged, refreshing, stale }: TimetableBodyProps) {
  const { session, offerDraft } = useReadySession();
  const { moduleById } = useReferenceData();
  const { openAdvisor } = useAdvisor();
  const shortlist = useShortlist();
  const reduce = useReducedMotion();
  const terms = view.grids.map((g) => g.term);
  const defaultTerm =
    view.grids.find((g) => view.clashes.some((c) => c.term === g.term))?.term ??
    view.grids.find((g) => g.slots.length > 0)?.term ??
    terms[0];
  const [chosen, setChosen] = useState<Term | undefined>(defaultTerm);
  const term = chosen && terms.includes(chosen) ? chosen : defaultTerm;
  const grid = view.grids.find((g) => g.term === term);

  const coreIds = new Set(view.coreModuleIds);
  const picked = session.shortlist.filter((id) => !coreIds.has(id));
  // Core modules are grey, so the module colours go to the student's own choices.
  const allModuleIds = [...picked, ...view.grids.flatMap((g) => g.slots.map((s) => s.moduleId)).filter((id) => !coreIds.has(id))];
  const colourFor = moduleColours(allModuleIds);
  const titleFor = (id: string) => moduleById.get(id)?.title ?? id;
  const codeFor = (id: string) => moduleById.get(id)?.code ?? id;

  const swap = async (s: SwapSuggestion) => {
    await shortlist.swap(s.replaceModuleId, s.withModuleId);
    onChanged();
  };

  // Issue 103: a clash with no swap in the fit window can still be resolved in one click by removing the module a
  // swap would replace: the one the alternatives replace, else the lower-fit module that is not core.
  const { byId } = useCatalogue();
  // While the view reloads after a change it may still show a clash the student has just resolved, so no target is
  // offered until it catches up, and a target must still be on the shortlist.
  const removeTargetFor = (clash: Clash): string | null => {
    if (refreshing) return null;
    const onShortlist = (id: string) => !coreIds.has(id) && session.shortlist.includes(id);
    const wider = view.widerSwaps.find(
      (s) => (s.replaceModuleId === clash.moduleA || s.replaceModuleId === clash.moduleB) && onShortlist(s.replaceModuleId),
    );
    if (wider) return wider.replaceModuleId;
    const [lower] = [clash.moduleA, clash.moduleB]
      .filter(onShortlist)
      .sort((x, y) => (byId.get(x)?.fit ?? 0) - (byId.get(y)?.fit ?? 0));
    return lower ?? null;
  };
  const remove = async (moduleId: string) => {
    await shortlist.remove(moduleId);
    onChanged();
  };

  // Spec 12: a clash with no valid swap can go to a personal tutor. The student reviews the draft in the
  // escalation tray above the screen and sends it, which moves the session from PLAN to ESCALATED.
  const escalate = (clash: Clash) => {
    const { programme, yearOfStudy } = session.profile;
    offerDraft({
      type: 'LOW_CONFIDENCE',
      summary: `${programme}, Year ${yearOfStudy}. ${titleFor(clash.moduleA)} and ${titleFor(clash.moduleB)} clash in the ${TERM_LABELS[clash.term].toLowerCase()} term, and no swap fits the programme rules within ${SWAP_FIT_TOLERANCE} fit points. A conversation with a personal tutor may help choose between them.`,
    });
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
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
            coreIds={coreIds}
            keepFree={view.keepFree}
            keepFreeConflicts={view.keepFreeConflicts}
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
          <AnimatePresence initial={false}>
            {view.clashes.length === 0 && (
              <motion.p
                key="no-clashes"
                initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : 0.2 }}
                className="flex items-center gap-2.5 rounded-card border border-fit-high/30 bg-fit-high/6 px-4 py-3 text-[13px]"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fit-high text-on-brand" aria-hidden="true">
                  <Icon name="check" size={13} />
                </span>
                Your shortlist fits together in every term, going by last year's timetable.
              </motion.p>
            )}
          </AnimatePresence>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <AnimatePresence initial={false}>
              {view.clashes.map((clash) => (
                <ClashCard
                  key={`${clash.moduleA}-${clash.moduleB}-${clash.term}`}
                  clash={clash}
                  swaps={view.swaps.filter((s) => s.replaceModuleId === clash.moduleA || s.replaceModuleId === clash.moduleB)}
                  widerSwaps={view.widerSwaps.filter((s) => s.replaceModuleId === clash.moduleA || s.replaceModuleId === clash.moduleB)}
                  removeTarget={removeTargetFor(clash)}
                  onRemove={remove}
                  titleFor={titleFor}
                  coreIds={coreIds}
                  onSwap={swap}
                  onAsk={openAdvisor}
                  onEscalate={escalate}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>

        <KeepFreePanel view={view} titleFor={titleFor} />

        <RulesPanel view={view} />

        <CapacityBackupPanel backups={view.backups} titleFor={titleFor} />

        <section aria-labelledby="shortlist-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="shortlist-heading" className="text-sm font-semibold">
              Your plan
            </h2>
          </div>
          <EctsBar ects={view.ects} />
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1">
            {view.coreModuleIds.map((id) => (
              <li key={id} className="flex items-center gap-2.5 rounded-lg py-1 text-[13px]">
                <Icon name="lock" size={12} className="shrink-0 text-muted" />
                <Link to={paths.module(id)} className="min-w-0 flex-1 truncate font-medium hover:text-brand">
                  {titleFor(id)}
                </Link>
                <span className="rounded-md bg-ink/6 px-1.5 py-0.5 text-[11px] font-semibold text-muted">Core</span>
              </li>
            ))}
            {picked.map((id) => (
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
          {picked.length === 0 && (
            <Link to={paths.catalogue} className={cx(buttonClass('secondary', 'sm'), 'mt-3 w-full')}>
              <Icon name="plus" size={14} />
              Add electives
            </Link>
          )}
          {shortlist.error && (
            <p role="alert" className="mt-2 text-[13px] text-fit-low">
              {shortlist.error}
            </p>
          )}
          <ExportActions view={view} titleFor={titleFor} codeFor={codeFor} stale={stale} />
        </section>
      </div>
    </div>
  );
}

/** All times come from previous years, so the whole view is provisional; say so before anything else. */
/**
 * Issue 63: take the plan away without an account or a sharing link. "Download plan" prints a one-page copy
 * (save it as a PDF from the print dialog) and "Add to calendar" saves an .ics; both are built in the browser.
 */
interface ExportActionsProps {
  view: TimetableView;
  titleFor: (id: string) => string;
  codeFor: (id: string) => string;
  /** Exports wait until the timetable matches the current shortlist, so a copy never mixes old and new. */
  stale: boolean;
}

function ExportActions({ view, titleFor, codeFor, stale }: ExportActionsProps) {
  const { session } = useReadySession();
  const { byId, scored, weights, recs } = useCatalogue();
  // The printed fit and top reason come from the recommendations, so printing waits for those to be current too.
  const printStale = stale || recs.loading || !recs.data || Boolean(recs.error);
  const { moduleById } = useReferenceData();
  const slots = view.grids.flatMap((g) => g.slots);
  const calendar = () =>
    downloadFile('modulematch-timetable-provisional.ics', 'text/calendar', buildIcs(slots, { titleFor, codeFor }));
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" icon="arrow-down" onClick={() => window.print()} disabled={printStale}>
          Download plan
        </Button>
        <Button size="sm" icon="calendar" onClick={calendar} disabled={stale || slots.length === 0}>
          Add to calendar
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Provisional, based on previous years. Saved on your device only.</p>
      {/* Left out while stale, so even the browser's own Print never mixes an old week with a new shortlist. */}
      {!printStale && (
        <PlanPrint
          view={view}
          shortlist={session.shortlist}
          fitOf={(id) => byId.get(id)}
          titleFor={titleFor}
          codeFor={codeFor}
          ectsOf={(id) => moduleById.get(id)?.ects ?? 0}
          weights={weights}
          scored={scored}
        />
      )}
    </div>
  );
}

function ProvisionalNotice() {
  return (
    <div
      role="note"
      className="flex items-center gap-2.5 rounded-card border border-dashed border-fit-mid/50 bg-fit-mid/8 px-3.5 py-2.5 text-[13px]"
    >
      <Icon name="clock" size={16} className="shrink-0 text-fit-mid" />
      <p className="min-w-0">
        <span className="font-semibold text-ink">Provisional: times from previous years.</span>{' '}
        <span className="text-muted">Check the confirmed timetable once it is published.</span>
      </p>
    </div>
  );
}

/** The week at a glance: clashes left to resolve, and ECTS planned against the year's target as a meter. */
function TimetableGlance({ view }: { view: TimetableView }) {
  const total = view.ects.core + view.ects.elective + view.ects.iExplore;
  const labels = ectsLabels(total, view.ects.max);
  return (
    <GlanceStats label="Your timetable at a glance" items={[{ label: view.clashes.length === 1 ? 'clash' : 'clashes', value: view.clashes.length }]}>
      <span className="grid w-28 gap-1">
        <span className="text-[11px] leading-tight text-muted">
          <span className="font-semibold text-ink tabular-nums">{total}</span> {labels.of}
        </span>
        <Meter
          value={view.ects.max ? total / view.ects.max : 0}
          label="ECTS planned"
          valueText={`${total} ${labels.of}`}
          tone={labels.over ? 'mid' : 'brand'}
        />
      </span>
    </GlanceStats>
  );
}

/** The plan's ECTS against the programme cap, as one stacked bar: core, electives, I-Explore. */
function EctsBar({ ects }: { ects: TimetableView['ects'] }) {
  const total = ects.core + ects.elective + ects.iExplore;
  const scale = Math.max(ects.max ?? 0, total) || 1;
  const labels = ectsLabels(total, ects.max);
  const parts = [
    { key: 'core', label: 'core', value: ects.core, className: 'bg-ink/45' },
    { key: 'elective', label: 'electives', value: ects.elective, className: 'bg-brand' },
    { key: 'iExplore', label: 'I-Explore', value: ects.iExplore, className: 'bg-mode-plan' },
  ];
  return (
    <div>
      <p className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold tabular-nums">
          {total} <span className="font-normal text-muted">{labels.of}</span>
        </span>
        <span className={cx('tabular-nums', labels.over ? 'text-fit-low' : 'text-muted')}>{labels.remaining}</span>
      </p>
      <div
        className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${total} ${labels.of}: ${parts.map((p) => `${p.value} ${p.label}`).join(', ')}`}
      >
        {parts.map((p) => (
          <span key={p.key} className={p.className} style={{ width: `${(p.value / scale) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted tabular-nums" aria-hidden="true">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1">
            <span className={cx('size-2 rounded-full', p.className)} />
            {p.value} {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Interview question 8: shortlisted sessions in time the student asked to keep free. A soft conflict, never a block. */
function KeepFreePanel({ view, titleFor }: { view: TimetableView; titleFor: (id: string) => string }) {
  if (view.keepFree.length === 0) return null;
  const conflicts = view.keepFreeConflicts;
  const shown = conflicts.slice(0, 4);
  return (
    <section aria-labelledby="keep-free-heading" className="rounded-card border border-mode-explain/30 bg-mode-explain/[0.05] p-4">
      <h2 id="keep-free-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Icon name="moon" size={15} className="text-mode-explain" />
        {conflicts.length === 0
          ? 'Your kept-free time stays free'
          : `${conflicts.length} session${conflicts.length > 1 ? 's' : ''} in kept-free time`}
      </h2>
      {shown.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {shown.map(({ slot, window }) => (
            <li key={`${slot.moduleId}|${slot.sessionKey}|${slot.day}|${slot.start}`} className="text-[13px] leading-snug">
              <span className="font-semibold tabular-nums">
                {DAY_LABELS[slot.day]} {slot.start}
              </span>{' '}
              <span className="text-muted">· {TERM_LABELS[slot.term]}</span> {titleFor(slot.moduleId)}
              <span className="block text-[12px] text-muted">{keepFreeLabel(window)}: you asked to keep this free</span>
            </li>
          ))}
        </ul>
      )}
      {conflicts.length > shown.length && (
        <p className="mt-1.5 text-[12px] text-muted">and {conflicts.length - shown.length} more</p>
      )}
    </section>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <span className="h-3.5 w-6 rounded border border-dashed border-ink/50 bg-surface-2" aria-hidden="true" />
        Provisional
      </li>
      <li className="flex items-center gap-1.5">
        <span className="grid h-3.5 w-6 place-items-center rounded border-l-[3px] border-ink/45 bg-ink/[0.07]" aria-hidden="true">
          <Icon name="lock" size={9} />
        </span>
        Core
      </li>
      <li className="flex items-center gap-1.5">
        <span className="grid h-3.5 w-6 place-items-center rounded bg-mode-explain/15 text-mode-explain" aria-hidden="true">
          <Icon name="moon" size={9} />
        </span>
        Kept free
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
