// Where the student is in the interview, derived from the plan steps already asked
// (session.interview.askedSteps) and from what the profile and evidence already hold.
import type { SessionState } from '@modulematch/shared';
import { useCallback, useEffect, useState } from 'react';
import type { IconName } from '../../components/Icon.tsx';

export type StepStatus = 'done' | 'current' | 'upcoming';

/** The server's quick-mode plan step ids (server/src/agents/interviewer.ts), in order. */
type PlanStepId = 'love' | 'avoid' | 'career' | 'assessment' | 'comfort' | 'team' | 'breadth' | 'timetable';

interface PlanStepMeta {
  id: PlanStepId;
  label: string;
  /** True when the profile holds an answer for this step (from the interview or a CV). Only then is it ticked. */
  filled: (session: SessionState) => boolean;
}

const hasEvidence = (session: SessionState, test: (slot: string) => boolean) =>
  session.evidence.some((e) => test(e.slot));
/** At least one of the step's style slots holds an answer. */
const styleKnown = (session: SessionState, ...keys: (keyof SessionState['profile']['style'])[]) =>
  keys.some((key) => session.profile.style[key] !== null);

const PLAN: readonly PlanStepMeta[] = [
  { id: 'love', label: 'Interests', filled: (s) => Object.keys(s.profile.interests).length > 0 },
  // A dislike is a low interest; "nothing really" is a fine answer too, so an asked avoid question also counts.
  {
    id: 'avoid',
    label: 'What to avoid',
    filled: (s) => Object.values(s.profile.interests).some((v) => v < 0.3) || s.interview.askedSteps.includes('avoid'),
  },
  {
    id: 'career',
    label: 'Career goals',
    filled: (s) =>
      s.profile.pathways.length > 0 || s.profile.pathwaysSkipped || hasEvidence(s, (slot) => slot === 'pathways'),
  },
  { id: 'assessment', label: 'Assessment', filled: (s) => styleKnown(s, 'examPreference', 'appliedPreference') },
  { id: 'comfort', label: 'Maths and coding', filled: (s) => styleKnown(s, 'mathsComfort', 'codingComfort') },
  { id: 'team', label: 'Team and workload', filled: (s) => styleKnown(s, 'groupPreference', 'workloadTolerance') },
  { id: 'breadth', label: 'Breadth', filled: (s) => s.profile.breadthAppetite !== null },
  {
    id: 'timetable',
    label: 'Timetable',
    filled: (s) => hasEvidence(s, (slot) => slot.startsWith('timetablePrefs')),
  },
];

const isPlanStep = (id: string | undefined): id is PlanStepId => PLAN.some((step) => step.id === id);

/** The three learning-style questions are shown as one section with sub-steps. */
const LEARNING_STEPS: ReadonlySet<PlanStepId> = new Set(['assessment', 'comfort', 'team']);

export interface TimelineStep {
  id: string;
  label: string;
  icon: IconName;
  status: StepStatus;
  /** Sub-steps, for "How you learn". */
  children?: TimelineStep[];
}

export interface TimelineExtra {
  id: 'cv' | 'societies';
  label: string;
  icon: IconName;
  done: boolean;
}

const ICONS: Record<PlanStepId, IconName> = {
  love: 'heart',
  avoid: 'ban',
  career: 'compass',
  assessment: 'edit',
  comfort: 'sliders',
  team: 'user',
  breadth: 'sparkle',
  timetable: 'calendar',
};

/**
 * A step is ticked only when the profile holds its answer and it is not the question on screen now. Asking a question
 * is not enough: an answer the extractor could not read leaves the step unticked, even after the interview ends.
 */
export function planStatuses(session: SessionState): Map<PlanStepId, StepStatus> {
  const { askedSteps, finished } = session.interview;
  const awaiting = finished ? undefined : sectionOf(askedSteps.at(-1));
  const statuses = new Map<PlanStepId, StepStatus>();
  for (const step of PLAN) {
    const done = step.id !== awaiting && step.filled(session);
    statuses.set(step.id, done ? 'done' : 'upcoming');
  }
  // A follow-up question reopens the section it belongs to, even if that section was done before.
  const current = awaiting ?? PLAN.find((step) => statuses.get(step.id) === 'upcoming')?.id;
  if (current && !finished) statuses.set(current, 'current');
  return statuses;
}

/** Follow-up question ids from the server's deep mode (`follow:<slot>`) and the plan section each belongs to. */
const FOLLOW_UP_SECTIONS: Record<string, PlanStepId> = {
  interest: 'love',
  pathways: 'career',
  'style.examPreference': 'assessment',
  'style.appliedPreference': 'assessment',
  'style.mathsComfort': 'comfort',
  'style.codingComfort': 'comfort',
  'style.groupPreference': 'team',
  'style.workloadTolerance': 'team',
  breadthAppetite: 'breadth',
};

/** The plan section an asked step id belongs to: a plan step itself, or the section of a follow-up. */
function sectionOf(stepId: string | undefined): PlanStepId | undefined {
  if (isPlanStep(stepId)) return stepId;
  if (stepId?.startsWith('follow:')) return FOLLOW_UP_SECTIONS[stepId.slice('follow:'.length)];
  return undefined;
}

export function buildTimeline(session: SessionState): TimelineStep[] {
  const statuses = planStatuses(session);
  const toStep = (meta: PlanStepMeta): TimelineStep => ({
    id: meta.id,
    label: meta.label,
    icon: ICONS[meta.id],
    status: statuses.get(meta.id) ?? 'upcoming',
  });
  const steps: TimelineStep[] = [];
  for (const meta of PLAN) {
    if (!LEARNING_STEPS.has(meta.id)) {
      steps.push(toStep(meta));
      continue;
    }
    let group = steps.find((s) => s.id === 'learning');
    if (!group) {
      group = { id: 'learning', label: 'How you learn', icon: 'tutor', status: 'upcoming', children: [] };
      steps.push(group);
    }
    group.children?.push(toStep(meta));
  }
  for (const step of steps) {
    if (!step.children) continue;
    const kids = step.children.map((c) => c.status);
    step.status = kids.every((s) => s === 'done') ? 'done' : kids.includes('current') ? 'current' : 'upcoming';
  }
  return steps;
}

type ExtraId = TimelineExtra['id'];
const extrasKey = (sessionId: string) => `modulematch.interview-extras.${sessionId}`;

function readExtras(sessionId: string): ExtraId[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(extrasKey(sessionId)) ?? '[]');
    return Array.isArray(raw) ? raw.filter((v): v is ExtraId => v === 'cv' || v === 'societies') : [];
  } catch {
    return [];
  }
}

/** The optional steps the student has completed in this session, remembered across reloads. */
export function useCompletedExtras(sessionId: string): [ReadonlySet<ExtraId>, (id: ExtraId) => void] {
  const [done, setDone] = useState<ReadonlySet<ExtraId>>(() => new Set(readExtras(sessionId)));
  useEffect(() => {
    if (done.size === 0) return;
    try {
      window.localStorage.setItem(extrasKey(sessionId), JSON.stringify([...done]));
    } catch {
      // Storage is unavailable; the tick still shows for this visit.
    }
  }, [done, sessionId]);
  const markDone = useCallback((id: ExtraId) => {
    setDone((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);
  return [done, markDone];
}
