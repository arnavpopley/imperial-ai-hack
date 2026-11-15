// Guards what staff see after deciding on an insight card, and the empty-state reason.
import { MIN_COHORT, parseSuggestedEdit } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { applySuggestedEdit, changeCount, diffDraft } from './derivedDraft.ts';
import { isSummaryCard, NO_INSIGHTS, outcomeOf, tagEditorLink } from './insights.ts';

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
  it('are counterfactual cards with no uplift', () => {
    expect(isSummaryCard({ kind: 'COUNTERFACTUAL', upliftPoints: null })).toBe(true);
    expect(isSummaryCard({ kind: 'COUNTERFACTUAL', upliftPoints: 2.8 })).toBe(false);
    expect(isSummaryCard({ kind: 'DEMAND', upliftPoints: null })).toBe(false);
  });
});

describe('tagEditorLink', () => {
  const accepted = {
    id: 'MECH70014:COUNTERFACTUAL:topics.entrepreneurship-innovation=0.3',
    moduleId: 'MECH70014',
    kind: 'COUNTERFACTUAL',
    decision: 'accepted',
  } as const;

  it('opens the tag editor with an accepted change filled in', () => {
    expect(tagEditorLink(accepted)).toBe('/staff/modules/MECH70014/tags?edit=topics.entrepreneurship-innovation%3D0.3');
  });

  it('offers no link before acceptance, for the summary card, or for other kinds', () => {
    expect(tagEditorLink({ ...accepted, decision: 'pending' })).toBeNull();
    expect(tagEditorLink({ ...accepted, id: 'MECH70014:COUNTERFACTUAL:summary' })).toBeNull();
    expect(tagEditorLink({ ...accepted, id: 'MECH70014:CLASH:1', kind: 'CLASH' })).toBeNull();
  });
});

describe('applySuggestedEdit', () => {
  const draft = {
    topics: { 'fluid-mechanics': 1 },
    skills: {},
    pathwayRelevance: {},
    demand: { examShare: 0.6, groupShare: 0.5, applied: 0.5, mathsIntensity: 0.5, codingIntensity: 0.5, workload: 0.5 },
  };

  it('adds a topic or sets a demand field, leaving the rest of the draft alone', () => {
    const withTopic = applySuggestedEdit(draft, parseSuggestedEdit('topics.languages=0.3'));
    expect(withTopic.topics).toEqual({ 'fluid-mechanics': 1, languages: 0.3 });
    const lessExam = applySuggestedEdit(draft, parseSuggestedEdit('demand.examShare=0.4'));
    expect(lessExam.demand).toEqual({ ...draft.demand, examShare: 0.4 });
    expect(changeCount(diffDraft(draft, lessExam))).toBe(1);
  });

  it('keeps the draft unchanged for a missing or malformed edit', () => {
    expect(applySuggestedEdit(draft, parseSuggestedEdit('demand.examShare=2'))).toBe(draft);
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
