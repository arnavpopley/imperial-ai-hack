// Screen 10: clashing module pairs ranked by priority = students who shortlisted both x P(clash) (spec 9.2).
import type { ClashPriority } from '@modulematch/shared';
import { useMemo } from 'react';
import { api } from '../../api.ts';
import { ClashChip } from '../components/ClashChip.tsx';
import { EmptyState, ErrorState, LoadingState, Panel, StatTile } from '../components/ui.tsx';
import { CheckIcon } from '../components/icons.tsx';
import { useResource } from '../hooks/useResource.ts';
import { clashLabel, focusRing, percent, plural } from '../lib/format.ts';
import { useStaffData } from '../StaffData.tsx';

export function TimetablePage() {
  const { state, reload } = useResource('clash-priorities', api.staff.clashPriorities);

  return (
    <div className="grid grid-cols-1 gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Timetabling</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Clashing module pairs across the synthetic cohort's shortlists, ranked by how many students they would hurt.
          Fix the top of this list before the timetable is fixed.
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
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1">
        <StatTile label="Clashing pairs" value={ranked.length} />
        <StatTile label="Certain clashes" value={certain} hint="Probability 1" />
        {top && (
          <StatTile
            label="Top priority"
            value={top.priority.toFixed(1)}
            hint={`${plural(top.students, 'student')} share that pair`}
          />
        )}
      </dl>

      <Panel title="Clash priority" description="Priority = students who shortlisted both modules × clash probability.">
        <div
          role="region"
          aria-label="Clash priority table"
          tabIndex={0}
          className={`-mx-5 overflow-x-auto ${focusRing}`}
        >
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Clashing module pairs, highest priority first</caption>
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="w-10 py-2 pl-5 font-medium">
                  #
                </th>
                <th scope="col" className="py-2 font-medium">
                  Module pair
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Students
                </th>
                <th scope="col" className="py-2 pl-4 font-medium">
                  Clash probability
                </th>
                <th scope="col" className="w-48 py-2 pr-5 font-medium">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={`${r.moduleA}|${r.moduleB}`} className="border-b border-line last:border-0">
                  <td className="py-3 pl-5 align-top text-muted tabular-nums">{i + 1}</td>
                  <th scope="row" className="py-3 pr-4 align-top font-normal">
                    <span className="sr-only">{pair(r)}</span>
                    <span aria-hidden="true" className="grid gap-1">
                      <ModuleName title={moduleTitle(r.moduleA)} code={moduleCode(r.moduleA)} />
                      <ModuleName title={moduleTitle(r.moduleB)} code={moduleCode(r.moduleB)} />
                    </span>
                  </th>
                  <td className="py-3 text-right align-top font-medium tabular-nums">{r.students}</td>
                  <td className="py-3 pl-4 align-top">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="w-10 tabular-nums">{percent(r.probability)}</span>
                      <ClashChip label={clashLabel(r.probability)} />
                    </span>
                  </td>
                  <td className="py-3 pr-5 align-top">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-2 flex-1 rounded-full bg-line/70">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: percent(r.priority / maxPriority) }}
                        />
                      </span>
                      <span className="w-10 text-right tabular-nums">{r.priority.toFixed(1)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-xs text-muted">
        Certain when every candidate slot overlaps (P = 1), likely from P = 0.3, possible below that. Synthetic cohort
        and slots.
      </p>
    </>
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
