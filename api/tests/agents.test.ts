// Offline agent behaviour: extraction, merge rules, interview planning and explanations (spec 10).
import { DEFAULT_WEIGHTS, type Evidence, type SessionState } from '@modulematch/shared';
import { fixtureModules, fixtureProfile, fixtureSession } from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { extract, extractByCues, mergeUpdates } from '../src/agents/extractor.ts';
import { classifyByRules } from '../src/agents/intent.ts';
import { nextQuestion, QUICK_PLAN, unfilledSlots, whatIHeard } from '../src/agents/interviewer.ts';
import { explainByRules } from '../src/agents/matcher.ts';
import { canTransition } from '../src/agents/modes.ts';

const PATHWAYS = ['aerospace-motorsport', 'robotics-automation', 'startup-founder'];
const emptyProfile = {
  ...fixtureProfile,
  interests: {},
  pathways: [],
  pathwaysSkipped: false,
  style: { examPreference: null, groupPreference: null, appliedPreference: null, mathsComfort: null, codingComfort: null, workloadTolerance: null },
  breadthAppetite: null,
  timetablePrefs: { avoidDays: [], earliestStart: null },
};

describe('extractor', () => {
  it('finds interests and quotes the student', () => {
    const updates = extractByCues('I lost track of time in the wind tunnel lab and loved the robotics project.', ['interest'], PATHWAYS);
    const slots = updates.map((u) => u.slot);
    expect(slots).toContain('interest:fluid-mechanics');
    expect(slots).toContain('interest:control-robotics');
    expect(updates[0]?.quote).toContain('wind tunnel');
  });

  it('lowers an interest when the student states a dislike', () => {
    const [update] = extractByCues('I would avoid thermodynamics if I could.', ['interest'], PATHWAYS);
    expect(update).toMatchObject({ slot: 'interest:thermodynamics-energy', dislike: true });
    const merged = mergeUpdates({ ...emptyProfile, interests: { 'thermodynamics-energy': 0.6 } }, [update!], { sessionId: 's', turnId: 't' });
    expect(merged.profile.interests['thermodynamics-energy']).toBe(0.1);
  });

  it('keeps the higher interest strength otherwise', () => {
    const merged = mergeUpdates({ ...emptyProfile, interests: { 'fluid-mechanics': 0.95 } }, [{ slot: 'interest:fluid-mechanics', value: 0.85, quote: 'q', confidence: 0.7 }], { sessionId: 's', turnId: 't' });
    expect(merged.profile.interests['fluid-mechanics']).toBe(0.95);
  });

  it('uses the question context for short answers', () => {
    expect(extractByCues('Not sure yet.', ['pathways'], PATHWAYS)).toEqual([expect.objectContaining({ slot: 'pathwaysSkipped', value: true })]);
    expect(extractByCues('Yes, definitely!', ['breadthAppetite'], PATHWAYS)).toEqual([expect.objectContaining({ slot: 'breadthAppetite', value: 0.85 })]);
    expect(extractByCues('I want to work in F1 aerodynamics.', ['pathways'], PATHWAYS)).toContainEqual(expect.objectContaining({ slot: 'pathways', value: ['aerospace-motorsport'] }));
  });

  it('reads style, timetable and slider answers', async () => {
    const updates = await extract('I prefer coursework and hands-on projects. Keep Fridays free and nothing before 10am.', ['style.examPreference', 'timetablePrefs.avoidDays'], PATHWAYS, { mathsComfort: 0.7, codingComfort: 0.4 });
    const bySlot = Object.fromEntries(updates.map((u) => [u.slot, u.value]));
    expect(bySlot).toMatchObject({
      'style.mathsComfort': 0.7,
      'style.codingComfort': 0.4,
      'style.examPreference': 0.2,
      'style.appliedPreference': 0.85,
      'timetablePrefs.avoidDays': ['fri'],
      'timetablePrefs.earliestStart': '10:00',
    });
  });

  it('writes one evidence row per applied update', () => {
    const { evidence, profile } = mergeUpdates(emptyProfile, [{ slot: 'style.groupPreference', value: 0.8, quote: 'team', confidence: 0.7 }], { sessionId: 's', turnId: 't' });
    expect(profile.style.groupPreference).toBe(0.8);
    expect(evidence).toEqual([expect.objectContaining({ slot: 'style.groupPreference', quote: 'team', turnId: 't' })]);
  });
});

describe('interviewer', () => {
  const session = (evidence: Evidence[], questionsAsked = 0): SessionState => ({
    ...fixtureSession,
    profile: emptyProfile,
    evidence,
    interview: { depth: 'quick', questionsAsked, budget: 8, finished: false, confirmed: false, askedSteps: [], targetSlots: [], disputes: 0 },
  });

  it('starts with the opening interest question', () => {
    expect(nextQuestion(session([]), [])?.step.id).toBe('love');
  });

  it('skips plan steps whose slots are already filled', () => {
    const ev = (slot: string): Evidence => ({ id: slot, sessionId: 's', turnId: 't', slot, value: 0.5, quote: 'q', confidence: 1 });
    const filled = ['interest:fluid-mechanics', 'interest:control-robotics', 'interest:statistics-data', 'pathwaysSkipped'].map(ev);
    expect(nextQuestion(session(filled, 2), ['love', 'avoid'])?.step.id).toBe('assessment');
    expect(nextQuestion(session(filled, 1), ['love'])?.step.id).toBe('avoid');
  });

  it('finishes when the budget is spent', () => {
    expect(nextQuestion(session([], 8), [])).toBeNull();
  });

  it('asks the slider question with a slider widget', () => {
    expect(QUICK_PLAN.find((s) => s.id === 'comfort')?.widget).toEqual({ kind: 'sliders', fields: ['mathsComfort', 'codingComfort'] });
  });

  it('lists all nine required slots for an empty profile', () => {
    expect(unfilledSlots(emptyProfile, [])).toHaveLength(9);
  });

  it('summarises the profile without inventing anything', () => {
    const card = whatIHeard(fixtureProfile, { 'aerospace-motorsport': 'Aerospace and motorsport' });
    expect(card).toContain('Fluid mechanics');
    expect(card).toContain('Aerospace and motorsport');
  });
});

describe('intent rules', () => {
  it('spots a rule-exception request naming a module', () => {
    const r = classifyByRules('Can I take Robotics and Control without the prerequisite?', 'RECOMMEND', fixtureModules);
    expect(r).toMatchObject({ intent: 'rule_exception_request', moduleIds: ['ME3-ROB'] });
  });
  it('treats interview turns as answers', () => {
    expect(classifyByRules('I like fluids', 'INTERVIEW', fixtureModules).intent).toBe('answer_interview');
  });
});

describe('matcher explanations', () => {
  it('cite evidence or module fields only', () => {
    const module = fixtureModules[0]!;
    const rec = { moduleId: module.id, fit: 77, sub: { interest: 0.82, goal: 0.9, style: 0.86, breadth: 0.05 }, eligible: true, ineligibleReasons: [], confidence: 'high' as const };
    const evidence: Evidence[] = [{ id: 'ev-1', sessionId: 's', turnId: 't', slot: 'interest:fluid-mechanics', value: 0.9, quote: 'wind tunnel', confidence: 0.9 }];
    const explanation = explainByRules(fixtureProfile, module, rec, evidence);
    expect(explanation.because.length).toBeGreaterThan(0);
    expect(explanation.because.every((b) => b.evidenceId || b.moduleField)).toBe(true);
    expect(explanation.because[0]?.evidenceId).toBe('ev-1');
    expect(DEFAULT_WEIGHTS.interest).toBeGreaterThan(0);
  });
});

describe('mode machine', () => {
  it('follows spec 12', () => {
    expect(canTransition('RECOMMEND', 'PLAN')).toBe(true);
    expect(canTransition('ESCALATED', 'RECOMMEND')).toBe(true);
    expect(canTransition('ONBOARD', 'PLAN')).toBe(false);
    expect(canTransition('EXPLAIN', 'PLAN')).toBe(false);
  });
});

describe('review fixes', () => {
  it('keeps the pattern-redacted text when a rewriting stage fails', async () => {
    const { runInputGuardrails } = await import('../src/guardrails/pipeline.ts');
    const g2 = await import('../src/guardrails/g2-redaction.ts');
    const { createTracer } = await import('../src/trace/tracer.ts');
    const { vi } = await import('vitest');
    const spy = vi.spyOn(g2, 'redaction').mockRejectedValue(new Error('outage'));
    const out = await runInputGuardrails('I love robotics. I have ADHD.', { mode: 'INTERVIEW', tracer: createTracer('s', () => {}) });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(out.text).toBe('I love robotics.');
  });
});
