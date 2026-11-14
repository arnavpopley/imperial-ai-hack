// WS1 repository round-trips on an in-memory database.
import type { Evidence, Insight, SessionState } from '@modulematch/shared';
import * as fx from '@modulematch/shared/fixtures';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../src/db/client.ts';
import * as repo from '../src/db/repo.ts';

let db: Db;
beforeEach(() => {
  db = openDb(':memory:');
});

const session: SessionState = fx.fixtureSession;

describe('sessions', () => {
  it('createSession then getSession returns the same state', () => {
    repo.createSession(session, db);
    expect(repo.getSession(session.id, db)).toEqual(session);
    expect(repo.getSession('missing', db)).toBeNull();
  });

  it('updateSession changes only the given fields and bumps updatedAt', () => {
    repo.createSession(session, db);
    const draft = { type: 'RULE_EXCEPTION' as const, summary: 'Wants a module without its prerequisite.' };
    const updated = repo.updateSession(session.id, { mode: 'ESCALATED', escalationDraft: draft }, db);
    expect(updated?.mode).toBe('ESCALATED');
    expect(updated?.escalationDraft).toEqual(draft);
    expect(updated?.weights).toEqual(session.weights);
    expect(updated?.updatedAt).not.toBe(session.updatedAt);
    expect(repo.updateSession(session.id, { escalationDraft: null }, db)?.escalationDraft).toBeNull();
    expect(repo.updateSession('missing', { mode: 'PLAN' }, db)).toBeNull();
  });

  it('saveProfile replaces the profile', () => {
    repo.createSession(session, db);
    const profile = { ...session.profile, interests: { 'control-robotics': 0.9 } };
    repo.saveProfile(session.id, profile, db);
    expect(repo.getSession(session.id, db)?.profile.interests).toEqual({ 'control-robotics': 0.9 });
  });

  it('deleteProfileAndEvidence clears interests and evidence but keeps onboarding answers', () => {
    repo.createSession(session, db);
    const blank = repo.deleteProfileAndEvidence(session.id, db);
    const state = repo.getSession(session.id, db);
    expect(blank?.interests).toEqual({});
    expect(state?.evidence).toEqual([]);
    expect(state?.profile.programme).toBe(session.profile.programme);
    expect(state?.profile.completedModuleIds).toEqual(session.profile.completedModuleIds);
    expect(state?.profile.completeness).toBe(0);
  });
});

describe('evidence and messages', () => {
  it('append in order', () => {
    repo.createSession({ ...session, evidence: [], messages: [] }, db);
    const ev: Evidence[] = [
      { id: 'e-a', sessionId: session.id, turnId: 't1', slot: 'pathways', value: ['robotics-automation'], quote: 'robots', confidence: 0.8 },
      { id: 'e-b', sessionId: session.id, turnId: 't1', slot: 'pathwaysSkipped', value: false, quote: 'no', confidence: 0.7 },
    ];
    repo.addEvidence(ev, db);
    expect(repo.listEvidence(session.id, db)).toEqual(ev);
    const [first, second] = session.messages;
    if (!first || !second) throw new Error('fixture needs two messages');
    repo.addMessage(second, db);
    repo.addMessage(first, db);
    expect(repo.listMessages(session.id, db).map((m) => m.id)).toEqual([second.id, first.id]);
  });
});

describe('shortlist', () => {
  it('adds idempotently, keeps insertion order and removes', () => {
    repo.createSession({ ...session, shortlist: [] }, db);
    repo.addToShortlist(session.id, 'B', db);
    repo.addToShortlist(session.id, 'A', db);
    expect(repo.addToShortlist(session.id, 'B', db)).toEqual(['B', 'A']);
    expect(repo.removeFromShortlist(session.id, 'B', db)).toEqual(['A']);
    expect(repo.listShortlist(session.id, db)).toEqual(['A']);
  });
});

describe('escalations', () => {
  it('create, list per session and for staff, and update', () => {
    repo.createSession({ ...session, escalations: [] }, db);
    const e = { ...fx.fixtureEscalation, id: 'esc-new' };
    repo.createEscalation(e, db);
    expect(repo.listEscalations(session.id, db)).toEqual([e]);
    expect(repo.listEscalations(undefined, db)).toEqual([e]);
    expect(repo.listEscalations('other', db)).toEqual([]);
    const done = repo.updateEscalation(e.id, { status: 'resolved', staffResponse: 'Approved.' }, db);
    expect(done).toEqual({ ...e, status: 'resolved', staffResponse: 'Approved.' });
    expect(repo.updateEscalation('missing', { status: 'claimed' }, db)).toBeNull();
  });
});

describe('insights', () => {
  it('upsert keeps the staff decision and setInsightDecision records it', () => {
    const insight: Insight = { ...(fx.fixtureInsights[0] as Insight), decision: 'pending' };
    repo.upsertInsights([insight], db);
    expect(repo.setInsightDecision(insight.id, 'accepted', db)?.decision).toBe('accepted');
    repo.upsertInsights([{ ...insight, headline: 'Refreshed' }], db);
    const [stored] = repo.listInsights(insight.moduleId, db);
    expect(stored?.headline).toBe('Refreshed');
    expect(stored?.decision).toBe('accepted');
    expect(repo.setInsightDecision('missing', 'noted', db)).toBeNull();
  });
});

describe('trace, modules, slots, cohort and eval runs', () => {
  it('trace events come back in insertion order', () => {
    for (const e of fx.fixtureTrace) repo.addTraceEvent(e, db);
    expect(repo.listTraceEvents(fx.fixtureTrace[0]?.sessionId ?? '', db)).toEqual(fx.fixtureTrace);
  });

  it('modules round-trip and staff edits set derivedBy', () => {
    repo.replaceModules(fx.fixtureModules, db);
    expect(repo.listModules(db)).toEqual([...fx.fixtureModules].sort((a, b) => a.id.localeCompare(b.id)));
    const [m] = fx.fixtureModules;
    if (!m) throw new Error('fixture needs a module');
    const edited = repo.updateModuleDerived(m.id, { topics: { 'fluid-mechanics': 0.5 } }, db);
    expect(edited?.topics).toEqual({ 'fluid-mechanics': 0.5 });
    expect(edited?.skills).toEqual(m.skills);
    expect(edited?.derivedBy).toBe('staff-edit');
    expect(repo.getModule('missing', db)).toBeNull();
  });

  it('slots and the cohort round-trip', () => {
    repo.replaceSlots(fx.fixtureSlots, db);
    expect(repo.listSlots(db)).toEqual(fx.fixtureSlots);
    const students = [{ profile: fx.fixtureProfile, shortlist: ['ME3-CFD'] }];
    repo.replaceCohort(students, db);
    expect(repo.listCohort(db)).toEqual(students);
  });

  it('latestEvalRun returns the most recent run', () => {
    expect(repo.latestEvalRun(db)).toBeNull();
    repo.saveEvalRun(fx.fixtureEvalRun, db);
    const later = { ...fx.fixtureEvalRun, id: 'eval-later', at: '2026-11-15T09:00:00.000Z' };
    repo.saveEvalRun(later, db);
    expect(repo.latestEvalRun(db)).toEqual(later);
  });
});
