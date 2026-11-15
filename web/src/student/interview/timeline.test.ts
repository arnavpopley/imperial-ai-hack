// Issue #55: a timeline step is ticked only when the profile holds its answer, not merely because it was asked.
import type { SessionState } from '@modulematch/shared';
import { fixtureSession } from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { planStatuses } from './timeline.ts';

const emptyStyle = { examPreference: null, groupPreference: null, appliedPreference: null, mathsComfort: null, codingComfort: null, workloadTolerance: null };

const session = (over: { askedSteps: string[]; finished: boolean; style?: Partial<SessionState['profile']['style']> }): SessionState => ({
  ...fixtureSession,
  evidence: [],
  profile: { ...fixtureSession.profile, interests: {}, pathways: [], pathwaysSkipped: false, breadthAppetite: null, style: { ...emptyStyle, ...over.style }, timetablePrefs: { avoidDays: [], earliestStart: null } },
  interview: { ...fixtureSession.interview, askedSteps: over.askedSteps, finished: over.finished },
});

describe('interview timeline', () => {
  it('leaves an asked step unticked when its answer could not be read, even after the interview ends', () => {
    const statuses = planStatuses(session({ askedSteps: ['love', 'avoid', 'career', 'assessment', 'team'], finished: true }));
    expect(statuses.get('assessment')).toBe('upcoming');
    expect(statuses.get('team')).toBe('upcoming');
    // "What to avoid" has no slot of its own, so asking it is enough.
    expect(statuses.get('avoid')).toBe('done');
  });

  it('ticks a step once one of its slots holds an answer', () => {
    const statuses = planStatuses(session({ askedSteps: ['love', 'assessment', 'team'], finished: false, style: { examPreference: 0.2 } }));
    expect(statuses.get('assessment')).toBe('done');
    // The question on screen now is the current step.
    expect(statuses.get('team')).toBe('current');
  });
});
