// The latest live-model evaluation run (GET /api/eval/live), as the "How it works" page shows it.
import type { EvalRun } from '@modulematch/shared';

export interface LiveEvalRun extends EvalRun {
  /** Absent on runs written before the script recorded its models. */
  models?: { smart: string; fast: string; light: string; judge: string };
}

/** "claude-opus-5-5" -> "Opus 5.5"; anything else is shown as given. */
export function modelName(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id);
  if (!m) return id;
  const family = m[1]!;
  return `${family[0]!.toUpperCase()}${family.slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`;
}

/** "Live: module facts" -> "Module facts". */
export function groupLabel(name: string): string {
  const bare = name.replace(/^Live:\s*/i, '');
  return bare ? `${bare[0]!.toUpperCase()}${bare.slice(1)}` : name;
}

export interface LiveGroup {
  name: string;
  label: string;
  passed: number;
  total: number;
  target: number;
  ok: boolean;
}

/** One row per group, with whether it met its target, plus every failing case with its reason. */
export function summarise(run: LiveEvalRun) {
  const groups: LiveGroup[] = run.results.map((r) => ({
    name: r.name,
    label: groupLabel(r.name),
    passed: r.passed,
    total: r.total,
    target: r.target,
    ok: r.total > 0 && r.passed / r.total >= r.target,
  }));
  const misses = run.results.flatMap((r) =>
    r.details.filter((d) => !d.pass).map((d) => ({ group: groupLabel(r.name), case: d.case, note: d.note ?? '' })),
  );
  return { groups, misses, met: groups.filter((g) => g.ok).length };
}
