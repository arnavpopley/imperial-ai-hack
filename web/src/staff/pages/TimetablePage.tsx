// Screen 10: clashing module pairs ranked by priority = students who shortlisted both x P(clash) (spec 9.2).
import type { ClashPriority } from '@modulematch/shared';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { api } from '../../api.ts';
import { ClashChip } from '../components/ClashChip.tsx';
import { EmptyState, ErrorState, LoadingState, Panel, StatTile } from '../components/ui.tsx';
import { AlertIcon, CalendarIcon, CheckIcon, ClockAlertIcon, UsersIcon } from '../components/icons.tsx';
import { CountUp } from '../../components/CountUp.tsx';
import { useResource } from '../hooks/useResource.ts';
import { clashLabel, focusRing, percent, plural } from '../lib/format.ts';
import { useStaffData } from '../StaffData.tsx';

export function TimetablePage() {
  const { state, reload } = useResource('clash-priorities', api.staff.clashPriorities);

  return (
    <div className="grid grid-cols-1 gap-8">
      <header className="grid gap-4">
        <h2 className="text-heading">Timetabling</h2>
        <p className="max-w-2xl text-base text-muted">
          Module pairs that students want together but that may clash, worst first. Fix the top of this list before
          the timetable is published.
        </p>
        <p className="flex max-w-2xl items-start gap-3 rounded-2xl bg-fit-mid/10 p-4 text-sm leading-relaxed ring-1 ring-fit-mid/25">
          <CalendarIcon className="mt-0.5 size-5 text-fit-mid" />
          <span>
            <span className="font-semibold">Based on previous years' timetables.</span> This year's slots are not
            fixed yet, so each clash is a likelihood drawn from where these modules have sat before.
          </span>
        </p>
      </header>
      {state.status === 'loading' && <LoadingState label="Loading clash priorities" rows={4} />}
      {state.status === 'error' && (
        <ErrorState title="Could not load clash priorities" error={state.error} onRetry={reload} />
      )}
      {state.status === 'ready' && <ClashPriorities rows={state.data} />}
    </div>
  );
}

function ClashPriorities({ rows }: { rows: ClashPriority[] }) {
  const { moduleTitle, moduleCode } = useStaffData();
  const ranked = useMemo(() => [...rows].sort((a, b) => b.priority - a.priority), [rows]);

  if (ranked.length === 0)
    return (
      <EmptyState icon={<CheckIcon className="size-6" />} title="No clashing pairs">
        No two shortlisted modules overlap in the current slots.
      </EmptyState>
    );

  const maxPriority = Math.max(...ranked.map((r) => r.priority), 1);
  const certain = ranked.filter((r) => clashLabel(r.probability) === 'certain').length;
  const top = ranked[0];

  const pair = (r: ClashPriority) => `${moduleTitle(r.moduleA)} and ${moduleTitle(r.moduleB)}`;

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Clashing pairs"
          icon={<ClockAlertIcon className="size-5" />}
          tone="bg-clash-likely/10 text-clash-likely"
          value={<CountUp value={ranked.length} />}
        />
        <StatTile
          label="Certain clashes"
          icon={<AlertIcon className="size-5" />}
          tone="bg-clash-certain/10 text-clash-certain"
          value={<CountUp value={certain} />}
          hint="Every candidate slot overlaps"
        />
        {top && (
          <StatTile
            label="Top priority"
            icon={<UsersIcon className="size-5" />}
            tone="bg-brand-soft text-brand"
            value={<CountUp value={top.priority} decimals={1} />}
            hint={`${plural(top.students, 'student')} share that pair`}
          />
        )}
      </dl>

      <Panel title="Clash priority" description="Priority = students who shortlisted both modules × chance they clash.">
        {/* Phones get a card per pair; the table needs more width than a phone has. */}
        <ol className="grid gap-3 md:hidden">
          {ranked.map((r, i) => (
            <li key={`${r.moduleA}|${r.moduleB}`} className="grid gap-3 rounded-2xl bg-surface-2 p-4">
              <span className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold tabular-nums ring-1 ring-line">
                  {i + 1}
                </span>
                <span className="grid min-w-0 gap-1">
                  <ModuleName title={moduleTitle(r.moduleA)} code={moduleCode(r.moduleA)} />
                  <ModuleName title={moduleTitle(r.moduleB)} code={moduleCode(r.moduleB)} />
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <span className="tabular-nums">{plural(r.students, 'student')}</span>
                <span className="tabular-nums text-muted">{percent(r.probability)} chance</span>
                <ClashChip label={clashLabel(r.probability)} />
              </span>
              <PriorityBar value={r.priority} max={maxPriority} />
            </li>
          ))}
        </ol>
        <div
          role="region"
          aria-label="Clash priority table"
          tabIndex={0}
          className={`-mx-card hidden overflow-x-auto md:block sm:-mx-card-lg ${focusRing}`}
        >
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Clashing module pairs, highest priority first</caption>
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="w-12 py-3 pl-8 font-medium">
                  #
                </th>
                <th scope="col" className="py-3 font-medium">
                  Module pair
                </th>
                <th scope="col" className="py-3 text-right font-medium">
                  Students
                </th>
                <th scope="col" className="py-3 pl-4 font-medium">
                  Clash probability
                </th>
                <th scope="col" className="w-48 py-3 pr-8 font-medium">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={`${r.moduleA}|${r.moduleB}`} className="border-b border-line last:border-0">
                  <td className="py-4 pl-8 align-top text-muted tabular-nums">{i + 1}</td>
                  <th scope="row" className="py-4 pr-4 align-top font-normal">
                    <span className="sr-only">{pair(r)}</span>
                    <span aria-hidden="true" className="grid gap-1">
                      <ModuleName title={moduleTitle(r.moduleA)} code={moduleCode(r.moduleA)} />
                      <ModuleName title={moduleTitle(r.moduleB)} code={moduleCode(r.moduleB)} />
                    </span>
                  </th>
                  <td className="py-4 text-right align-top font-medium tabular-nums">{r.students}</td>
                  <td className="py-4 pl-4 align-top">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="w-10 tabular-nums">{percent(r.probability)}</span>
                      <ClashChip label={clashLabel(r.probability)} />
                    </span>
                  </td>
                  <td className="py-4 pr-8 align-top">
                    <PriorityBar value={r.priority} max={maxPriority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-sm text-muted">
        Certain when every candidate slot overlaps, likely from a 30% chance, possible below that. Synthetic cohort.
      </p>
    </>
  );
}

function PriorityBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/70">
        <motion.span
          className="block h-full rounded-full bg-gradient-to-r from-brand to-mode-explain"
          initial={{ width: 0 }}
          animate={{ width: percent(value / max) }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </span>
      <span className="w-10 text-right font-medium tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}

function ModuleName({ title, code }: { title: string; code: string | null }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">{title}</span>
      {code && <span className="font-mono text-xs text-muted">{code}</span>}
    </span>
  );
}
