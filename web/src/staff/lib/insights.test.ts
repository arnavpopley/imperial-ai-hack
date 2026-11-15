// Guards what staff see after deciding on an insight card, and the empty-state reason.
import { MIN_COHORT } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { canEditTags, isSummaryCard, NO_INSIGHTS, outcomeOf } from './insights.ts';

describe('outcomeOf', () => {
  it('says nothing while a card is pending', () => {
    expect(outcomeOf({ kind: 'COUNTERFACTUAL', decision: 'pending' })).toBeNull();
  });

  it('logs an accepted counterfactual for the module review, owned by the module lead', () => {
    expect(outcomeOf({ kind: 'COUNTERFACTUAL', decision: 'accepted' })).toEqual({
      title: 'Logged for the module review',
      owner: 'module lead',
    });
  });

  it('sends an accepted clash to the timetabling team', () => {
    expect(outcomeOf({ kind: 'CLASH', decision: 'accepted' })?.owner).toBe('timetabling team');
  });

  it('logs no follow-up for a noted or dismissed card', () => {
    expect(outcomeOf({ kind: 'DEMAND', decision: 'noted' })?.owner).toBeNull();
    expect(outcomeOf({ kind: 'DEMAND', decision: 'dismissed' })?.owner).toBeNull();
  });
});

describe('summary cards', () => {
  it('are counterfactual cards with no uplift, and do not link to the tag editor', () => {
    const summary = { kind: 'COUNTERFACTUAL', upliftPoints: null, decision: 'accepted' } as const;
    expect(isSummaryCard(summary)).toBe(true);
    expect(canEditTags(summary)).toBe(false);
    expect(canEditTags({ ...summary, upliftPoints: 2.8 })).toBe(true);
    expect(canEditTags({ ...summary, upliftPoints: 2.8, decision: 'pending' })).toBe(false);
    expect(isSummaryCard({ kind: 'DEMAND', upliftPoints: null })).toBe(false);
  });
});

describe('NO_INSIGHTS', () => {
  it('names the five-student group rule as the reason', () => {
    expect(MIN_COHORT).toBe(5);
    expect(NO_INSIGHTS.title).toBe('Fewer than 5 interested students in the group');
    expect(NO_INSIGHTS.body).toContain('fewer than 5 are');
    expect(NO_INSIGHTS.body).not.toMatch(/check back/i);
  });
});
