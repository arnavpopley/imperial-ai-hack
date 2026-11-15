// Offline agent behaviour: extraction, merge rules, interview planning and explanations (spec 10).
import { DEFAULT_WEIGHTS, type Evidence, type SessionState } from '@modulematch/shared';
import { fixtureModules, fixtureProfile, fixtureSession, fixtureTimetable } from '@modulematch/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { extract, extractByCues, grounded, mergeUpdates, plausible } from '../src/agents/extractor.ts';
import { classifyByRules } from '../src/agents/intent.ts';
import { nextQuestion, QUICK_PLAN, reflect, unfilledSlots, whatIHeard } from '../src/agents/interviewer.ts';
import { explainByRules } from '../src/agents/matcher.ts';
import { canTransition } from '../src/agents/modes.ts';
import { decisionReply, draftRuleException, reasonFrom, thirdPerson } from '../src/agents/escalation.ts';
import { describeTimetable } from '../src/agents/timetabler.ts';

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

  it('does not read an assessment or hands-on preference off a topic name', () => {
    const slots = (text: string) => extractByCues(text, ['interest'], PATHWAYS).map((u) => u.slot);
    expect(slots('I lost track of time in the wind tunnel lab and the CFD coursework.')).not.toContain('style.examPreference');
    expect(slots('Building robots and programming the electronics is what I love.')).not.toContain('style.appliedPreference');
    // Asked directly, the same words do state a preference.
    expect(extractByCues('Building things, definitely.', ['style.examPreference', 'style.appliedPreference'], PATHWAYS)).toContainEqual(
      expect.objectContaining({ slot: 'style.appliedPreference', value: 0.85 }),
    );
  });

  it('reads dreading proofs as low maths comfort and a lean towards applied work', () => {
    const bySlot = Object.fromEntries(extractByCues('Anything with heavy derivations, proofs are a slog for me.', ['interest'], PATHWAYS).map((u) => [u.slot, u.value]));
    expect(bySlot).toMatchObject({ 'style.mathsComfort': 0.3, 'style.appliedPreference': 0.8 });
  });

  it('grounds a shortened quote to the verbatim span and drops an invented one', () => {
    const text = 'Honestly the maths modules and the statistics course were my favourite.';
    const u = (quote: string) => ({ slot: 'interest:mathematics-modelling', value: 0.9, quote, confidence: 0.9 });
    expect(grounded(text, [u('the maths modules were my favourite')])).toEqual([u('the maths modules and the statistics course were my favourite')]);
    expect(grounded(text, [u('the maths modules')])).toEqual([u('the maths modules')]);
    expect(grounded(text, [u('I adore algebra')])).toEqual([]);
    // A repair that would skip a negation flips the meaning, so it is refused.
    expect(grounded('The CFD modules were not my favourite.', [u('the CFD modules were my favourite')])).toEqual([]);
  });

  it('reads negated assessment options, workload phrases and a hedged yes (issue #55)', () => {
    const value = (text: string, slot: string, target: string[]) => extractByCues(text, target, PATHWAYS).find((x) => x.slot === slot)?.value;
    const assessment = ['style.examPreference', 'style.appliedPreference'];
    const team = ['style.groupPreference', 'style.workloadTolerance'];
    expect(value('No exams please.', 'style.examPreference', assessment)).toBe(0.2);
    expect(value('Coursework and projects, definitely not big exams.', 'style.examPreference', assessment)).toBe(0.2);
    expect(value('Exams, not coursework.', 'style.examPreference', assessment)).toBe(0.8);
    expect(value('A moderate workload is fine.', 'style.workloadTolerance', team)).toBe(0.5);
    expect(value('Heavy is fine, I can handle a lot.', 'style.workloadTolerance', team)).toBe(0.8);
    expect(value('Light, not too much.', 'style.workloadTolerance', team)).toBe(0.25);
    expect(value('Yes, maybe one module outside engineering.', 'breadthAppetite', ['breadthAppetite'])).toBe(0.7);
    // Phrases where "not" accepts the option, a rejected heavy load, and a style-only answer to the two-part question.
    expect(value("I'm not averse to exams.", 'style.examPreference', assessment)).not.toBe(0.2);
    expect(value('No problem with coursework, honestly.', 'style.examPreference', assessment)).not.toBe(0.8);
    expect(value("Heavy isn't fine for me.", 'style.workloadTolerance', team)).toBe(0.25);
    expect(value('Working alone is fine.', 'style.workloadTolerance', team)).toBeUndefined();
    expect(value('Moderate.', 'style.workloadTolerance', team)).toBe(0.5);
    expect(value('Heavy is fine, not a problem.', 'style.workloadTolerance', team)).toBe(0.8);
    expect(value('Normal.', 'style.workloadTolerance', ['style.workloadTolerance'])).toBe(0.5);
    expect(value('Manageable.', 'style.workloadTolerance', ['style.workloadTolerance'])).toBe(0.5);
    // A sentence about assessment is never read as breadth, even when breadth is a target.
    expect(value('No exams please.', 'breadthAppetite', ['breadthAppetite'])).toBeUndefined();
  });

  it('lets the main clause decide the team preference', () => {
    const group = (text: string) => extractByCues(text, ['style.groupPreference'], PATHWAYS).find((x) => x.slot === 'style.groupPreference')?.value;
    expect(group('I prefer group work though I can work alone.')).toBe(0.7);
    expect(group("I'm more productive solo, though I can handle group work if necessary.")).toBe(0.3);
    expect(group('I work best on my own.')).toBe(0.2);
    expect(group('Team work please, but a lighter workload this year.')).toBe(0.8);
    expect(group('I prefer group work over working alone.')).toBe(0.8);
    expect(group('I hate group work, I prefer working alone.')).toBe(0.2);
    expect(group("I don't mind group work but I prefer working alone.")).toBe(0.3);
    expect(group("I'd rather not work alone.")).toBe(0.8);
    expect(group('I hate having to do projects in a group.')).toBe(0.2);
    expect(group('I hate working alone and prefer groups.')).toBe(0.8);
    expect(group('I hate exams so I much prefer working in a group.')).toBe(0.8);
    expect(group('I hate exams, I prefer working in a group.')).toBe(0.8);
    expect(group('Group work is boring for me.')).toBe(0.2);
    expect(group('I hate things like group projects.')).toBe(0.2);
    expect(group('I hate exams yet love working in a group.')).toBe(0.8);
    expect(group('I hate exams but enjoy working in a group.')).toBe(0.8);
    expect(group('I really dislike all the group projects we get.')).toBe(0.2);
    expect(group('I hate deadlines but I really like working with a team.')).toBe(0.8);
    expect(group('I prefer working in a team, and a heavy workload is fine.')).toBe(0.8);
  });

  it('reads typed comfort phrases when no slider values were sent', async () => {
    const updates = await extract('Maths comfort: 70%. Coding comfort: 40%', ['style.mathsComfort', 'style.codingComfort'], PATHWAYS);
    expect(updates.map((x) => [x.slot, x.value])).toEqual([
      ['style.mathsComfort', 0.7],
      ['style.codingComfort', 0.4],
    ]);
    // Inside a longer message the percentage may be a correction, so it is not saved as an answer.
    const corrected = await extract('Maths comfort: 70% is wrong; please leave it unset.', ['style.mathsComfort'], PATHWAYS);
    expect(corrected.filter((x) => x.slot === 'style.mathsComfort' && x.value === 0.7)).toEqual([]);
  });

  it('drops slots the words do not state, whichever extractor produced them', () => {
    const keep = (slot: string, value: unknown, text: string, target: string[] = ['interest']) =>
      plausible({ slot, value: value as number, quote: text, confidence: 0.8 }, text, target);
    expect(keep('timetablePrefs.earliestStart', '06:00', 'I dedicate two hours each morning to review.', ['timetablePrefs.earliestStart'])).toBe(false);
    expect(keep('timetablePrefs.earliestStart', '17:00', 'I work on Tuesdays from noon until five.', ['timetablePrefs.earliestStart'])).toBe(false);
    expect(keep('timetablePrefs.earliestStart', '10:00', 'Nothing before 10am please.', ['timetablePrefs.earliestStart'])).toBe(true);
    expect(keep('pathways', ['energy-transition'], 'I am leaning towards a thesis on urban sustainability.')).toBe(false);
    expect(keep('pathways', ['research-academia'], 'I want to do a PhD.')).toBe(true);
    expect(keep('pathwaysSkipped', true, "I'm torn between a PhD and policy.", ['pathways'])).toBe(false);
    expect(keep('style.codingComfort', 0.75, 'My syntax is usually correct.')).toBe(false);
    expect(keep('timetablePrefs.avoidDays', [], 'I avoid all social commitments.')).toBe(false);
    expect(keep('interest:fluid-mechanics', 0.9, 'Anything about wind.')).toBe(true);
    // A short answer to the question that asked for the slot needs no keyword; a long one must name it.
    expect(keep('style.groupPreference', 0.8, 'Yes, really enjoyed it.', ['style.groupPreference'])).toBe(true);
    expect(keep('style.workloadTolerance', 0.7, "I'm more productive solo, though I can handle group work if necessary.", ['style.groupPreference', 'style.workloadTolerance'])).toBe(false);
    for (const text of ['No lectures earlier than 10 please.', 'Nothing before ten.', "Not before nine o'clock."]) {
      expect(keep('timetablePrefs.earliestStart', '10:00', text, ['timetablePrefs.earliestStart'])).toBe(true);
    }
  });

  it('reads a slider answer as comfort only, never as an interest', async () => {
    const updates = await extract('Maths comfort: 70%. Coding comfort: 40%', ['style.mathsComfort', 'style.codingComfort'], PATHWAYS, { mathsComfort: 0.7, codingComfort: 0.4 });
    expect(updates.map((u) => [u.slot, u.value])).toEqual([
      ['style.mathsComfort', 0.7],
      ['style.codingComfort', 0.4],
    ]);
    expect(extractByCues('Maths comfort: 70%. Coding comfort: 40%', ['interest'], PATHWAYS)).toEqual([]);
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

  it('keeps half a day free for "Wednesday afternoons", not the whole day', () => {
    const slots = ['timetablePrefs.avoidDays', 'timetablePrefs.earliestStart'];
    const updates = extractByCues('Keep Wednesday afternoons free for sport, and nothing before 10am please.', slots, PATHWAYS);
    const { profile } = mergeUpdates(emptyProfile, updates, { sessionId: 's', turnId: 't' });
    expect(profile.timetablePrefs).toEqual({ avoidDays: [], avoidHalfDays: ['wed-pm'], earliestStart: '10:00' });
    const mixed = extractByCues('Fridays and Monday mornings, if you can.', slots, PATHWAYS);
    expect(mergeUpdates(emptyProfile, mixed, { sessionId: 's', turnId: 't' }).profile.timetablePrefs).toMatchObject({
      avoidDays: ['fri'],
      avoidHalfDays: ['mon-am'],
    });
    // A later half-day answer narrows an earlier whole day, and a whole day absorbs its half days.
    const narrowed = mergeUpdates(
      emptyProfile,
      extractByCues('Keep Wednesdays free. Actually, only Wednesday afternoons.', slots, PATHWAYS),
      { sessionId: 's', turnId: 't' },
    );
    expect(narrowed.profile.timetablePrefs).toMatchObject({ avoidDays: [], avoidHalfDays: ['wed-pm'] });
    const widened = mergeUpdates(narrowed.profile, extractByCues('All of Wednesday, please.', slots, PATHWAYS), { sessionId: 's', turnId: 't' });
    expect(widened.profile.timetablePrefs).toMatchObject({ avoidDays: ['wed'], avoidHalfDays: [] });
    // "No preference" clears both.
    const cleared = mergeUpdates(profile, extractByCues('No, anytime is fine.', slots, PATHWAYS), { sessionId: 's', turnId: 't' });
    expect(cleared.profile.timetablePrefs).toMatchObject({ avoidDays: [], avoidHalfDays: [] });
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

  it('spells out the days to keep free', () => {
    const card = whatIHeard({ ...fixtureProfile, timetablePrefs: { avoidDays: ['fri'], earliestStart: null } }, {});
    expect(card).toContain('Keep free: Friday');
  });

  it('keeps acronyms in the reflection', () => {
    const heard: Evidence = { id: 'e1', sessionId: 's1', turnId: 't1', slot: 'interest:machine-learning-ai', value: 0.85, quote: 'I love ML', confidence: 0.7 };
    expect(reflect([heard])).toBe('Got it: machine learning and AI.');
  });
});

describe('intent rules', () => {
  it('spots a rule-exception request naming a module', () => {
    const r = classifyByRules('Can I take Robotics and Control without the prerequisite?', 'RECOMMEND', fixtureModules);
    expect(r).toMatchObject({ intent: 'rule_exception_request', moduleIds: ['ME3-ROB'] });
  });
  it('spots a credit-rule exception during the interview without a module name', () => {
    expect(classifyByRules('Can I take extra credits this year?', 'INTERVIEW', fixtureModules).intent).toBe('rule_exception_request');
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

describe('timetabler wording', () => {
  it('says when no swap keeps kept-free time free', () => {
    const [swap] = fixtureTimetable.swaps;
    if (!swap) throw new Error('expected a fixture swap');
    const title = (id: string) => id;
    expect(describeTimetable(fixtureTimetable.clashes, [swap], title)).not.toContain('kept-free');
    expect(describeTimetable(fixtureTimetable.clashes, [{ ...swap, keepFreeConflicts: 2 }], title)).toContain(
      'No swap keeps all your kept-free time free; this one has 2 sessions in it.',
    );
    // A later clash's swap that keeps the time free is offered instead of an earlier one that does not.
    const mixed = describeTimetable(fixtureTimetable.clashes, [{ ...swap, keepFreeConflicts: 1 }, { ...swap, withModuleId: 'FREE' }], title);
    expect(mixed).toContain('for FREE');
    expect(mixed).not.toContain('No swap keeps');
  });
});

describe('rule-exception drafts', () => {
  const rob = fixtureModules.find((m) => m.id === 'ME3-ROB')!;
  const violation = {
    code: 'PREREQUISITE_MISSING' as const,
    moduleId: rob.id,
    prerequisiteId: 'ME2-CTRL',
    message: 'ME3-ROB Robotics and Control requires ME2-CTRL (Control Systems), which is not among your completed modules.',
  };

  it('are written in the third person, for the Senior Tutor', () => {
    const draft = draftRuleException(fixtureProfile, [violation], 'Can I take Robotics and Control?', rob);
    expect(draft.summary).toContain(`The student asks to take ${rob.code} ${rob.title}`);
    expect(draft.summary).toContain("not among the student's completed modules");
    expect(draft.summary).not.toMatch(/\b[Yy]ou(r)?\b/);
    expect(draft).toMatchObject({ moduleId: 'ME3-ROB', violations: [violation], reason: '' });
  });

  it('turn advice to the student into a statement of the rule', () => {
    expect(thirdPerson('X is not open to year 3 students. You can choose the core modules.')).toBe('X is not open to year 3 students.');
    expect(thirdPerson('Your plan totals 80 ECTS. Remove at least 5 ECTS.')).toBe("The student's plan totals 80 ECTS.");
  });

  it('suggest a reason only when the student gave one', () => {
    expect(reasonFrom('Can I take it because I did control on placement?')).toBe('I did control on placement.');
    expect(reasonFrom('Can I take Robotics and Control?')).toBe('');
    expect(reasonFrom(`Please, since ${'x'.repeat(400)}`)).toHaveLength(200);
  });

  it('decision replies lead with the decision and keep the tutor message', () => {
    const waiver = { moduleId: rob.id, waived: [{ code: 'PREREQUISITE_MISSING' as const, prerequisiteId: 'ME2-CTRL' }] };
    expect(decisionReply('approve', rob, waiver, 'See me in week 1.')).toBe(
      `Exception approved: you can now take ${rob.code} Robotics and Control, and add it to your shortlist. Its credits still count towards your credit cap. See me in week 1.`,
    );
    expect(decisionReply('decline', undefined, null, '')).toBe('Exception declined: the programme rule still applies.');
  });

  it('an approval that waives nothing, such as a credit-cap request, says the plan is unchanged', () => {
    const reply = decisionReply('approve', rob, null, '');
    expect(reply).toContain('your plan is unchanged');
    expect(reply).not.toContain('you can now take');
  });
});

describe('mode machine', () => {
  it('follows spec 12', () => {
    expect(canTransition('RECOMMEND', 'PLAN')).toBe(true);
    expect(canTransition('ESCALATED', 'RECOMMEND')).toBe(true);
    expect(canTransition('ONBOARD', 'PLAN')).toBe(false);
    expect(canTransition('PLAN', 'EXPLAIN')).toBe(true);
    expect(canTransition('EXPLAIN', 'PLAN')).toBe(true);
    expect(canTransition('ESCALATED', 'PLAN')).toBe(false);
    expect(canTransition('EXPLAIN', 'ESCALATED')).toBe(true);
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
