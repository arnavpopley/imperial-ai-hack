// Performance engine (spec 23): topic strengths from the student's own consented marks, and informational nudges on
// catalogue modules. Pure code, no model. Nudges never touch fit scores or rankings: they inform; the student decides.
import type { Module, PerformanceNudge, PerformanceView, StudentResults, TopicStrength } from '@modulematch/shared';
import { compareIds, mean, roundTo, topicLabel } from './util.ts';

/** A module topic counts towards the student's topic average from this weight ("a significant part", as in the matcher). */
export const TOPIC_CONTRIBUTION_MIN = 0.3;
/** A module's main topics, the ones a nudge can be attached to. */
export const MAIN_TOPIC_MIN = 0.5;
/** A topic is weak when its average is at least this many marks below the student's own overall average. */
export const NUDGE_THRESHOLD = 5;

export interface PerformanceOptions {
  /** The student's interests, so a nudge can say "you're interested in ..." only when they said so. */
  interests?: Record<string, number>;
  /** Modules that get no nudge: those already taken or completed. */
  exclude?: string[];
}

const EMPTY: PerformanceView = { consent: false, overallAverage: null, topics: [], nudges: [] };

/** Topic strengths and nudges. Only matched results count; unmatched codes are kept but never used. */
export function performanceView(results: StudentResults, modules: Module[], opts: PerformanceOptions = {}): PerformanceView {
  if (!results.consent.granted) return EMPTY;
  const byId = new Map(modules.map((m) => [m.id, m]));
  const taken = results.results.filter((r) => r.matched && byId.has(r.moduleId));
  if (taken.length === 0) return { ...EMPTY, consent: true };
  const overall = mean(taken.map((r) => r.mark));

  const sums = new Map<string, { weighted: number; weight: number; modules: { id: string; mark: number }[] }>();
  for (const r of taken) {
    for (const [topic, weight] of Object.entries(byId.get(r.moduleId)!.topics)) {
      if (weight < TOPIC_CONTRIBUTION_MIN) continue;
      const s = sums.get(topic) ?? { weighted: 0, weight: 0, modules: [] };
      s.weighted += weight * r.mark;
      s.weight += weight;
      s.modules.push({ id: r.moduleId, mark: r.mark });
      sums.set(topic, s);
    }
  }
  const raw = [...sums.entries()].map(([topic, s]) => ({ topic, average: s.weighted / s.weight, modules: s.modules }));
  const topics: TopicStrength[] = raw
    .map((t) => ({ topic: t.topic, average: roundTo(t.average, 1), delta: roundTo(t.average - overall, 1), modules: t.modules.map((m) => m.id) }))
    .sort((a, b) => a.delta - b.delta || compareIds(a.topic, b.topic));

  const weak = new Map(raw.filter((t) => t.average - overall <= -NUDGE_THRESHOLD).map((t) => [t.topic, t]));
  const exclude = new Set([...(opts.exclude ?? []), ...taken.map((r) => r.moduleId)]);
  const nudges: PerformanceNudge[] = [];
  for (const m of [...modules].sort((a, b) => compareIds(a.id, b.id))) {
    if (exclude.has(m.id)) continue;
    const hits = Object.entries(m.topics)
      .filter(([topic, weight]) => weight >= MAIN_TOPIC_MIN && weak.has(topic))
      .map(([topic]) => weak.get(topic)!)
      .sort((a, b) => a.average - b.average || compareIds(a.topic, b.topic));
    const worst = hits[0];
    if (!worst) continue;
    const lowest = [...worst.modules].sort((a, b) => a.mark - b.mark || compareIds(a.id, b.id))[0]!;
    nudges.push({
      moduleId: m.id,
      topics: hits.map((h) => h.topic),
      delta: roundTo(worst.average - overall, 1),
      message: nudgeMessage({
        module: m.title,
        topic: topicLabel(worst.topic).toLowerCase(),
        interested: (opts.interests?.[worst.topic] ?? 0) >= 0.5,
        topicGap: Math.round(overall - worst.average),
        lowestTitle: byId.get(lowest.id)!.title,
        lowestGap: Math.round(overall - lowest.mark),
      }),
    });
  }
  return { consent: true, overallAverage: roundTo(overall, 1), topics, nudges };
}

/** Kind, specific nudge text: names the module and the topic, and never tells the student to avoid the module. */
export function nudgeMessage(a: { module: string; topic: string; interested: boolean; topicGap: number; lowestTitle: string; lowestGap: number }): string {
  const lowest = a.lowestGap > 0 ? `your ${a.lowestTitle} mark was ${a.lowestGap} below your average` : `your ${a.topic} marks are below your usual level`;
  if (a.interested) {
    return `You're interested in ${a.topic}, and ${a.module} builds on it, but ${lowest}. Worth keeping in mind: some early revision of ${a.topic} would set you up well.`;
  }
  return `${a.module} leans on ${a.topic}, where your marks so far are about ${a.topicGap} below your own average (${lowest}). Not a reason to avoid it, just something to keep in mind and prepare for.`;
}

/** The nudge for one module, if any. */
export const nudgeFor = (view: PerformanceView, moduleId: string): PerformanceNudge | undefined => view.nudges.find((n) => n.moduleId === moduleId);
