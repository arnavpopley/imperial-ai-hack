// Spec 9.3: counterfactual uplift, other insight kinds, cohort stats and the minimum-cohort privacy rule.
import { DEFAULT_WEIGHTS, formatSuggestedEdit, parseSuggestedEdit, suggestedEditOf } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { plainWording, sameNumbers } from '../src/agents/insights.ts';
import {
  buildInsights,
  clashInsights,
  cohortStats,
  counterfactualInsights,
  counterfactuals,
  demand,
  interestedButUnconvinced,
  levelInWords,
  mainGap,
  MEANINGFUL_UPLIFT,
  overlooked,
  shareInWords,
  storedDecisions,
  suggestedEditFor,
  type InsightContext,
} from '../src/engines/index.ts';
import { makeModule, makeProfile, makeRules, makeSlot } from './engines-fixtures.ts';

// Interested in fluids and thermodynamics, uneasy with maths.
const interested = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    makeProfile({
      studentId: `keen-${i}`,
      interests: { 'fluid-mechanics': 1, 'thermodynamics-energy': 1 },
      style: { ...makeProfile().style, mathsComfort: 0.2 },
    }),
  );
const uninterested = Array.from({ length: 3 }, (_, i) => makeProfile({ studentId: `other-${i}` }));

// I = 0.5, L = 0.3, so Fit = round(100 · (0.45·0.5 + 0.2·0.3) / 0.75) = 38.
const target = makeModule('target', {
  topics: { 'fluid-mechanics': 1, 'policy-ethics': 1 },
  demand: { examShare: 0.5, groupShare: 0.5, applied: 0.5, mathsIntensity: 0.9, codingIntensity: 0.5, workload: 0.5 },
  capacity: 100,
});
const filler = (id: string) => makeModule(id, { topics: { languages: 1 } });

function context(cohortSize: number, shortlists: string[][] = []): InsightContext {
  return {
    modules: [target, filler('f1'), filler('f2')],
    cohort: [...interested(cohortSize), ...uninterested],
    shortlists,
    weights: DEFAULT_WEIGHTS,
    homeTopics: {},
    slots: [makeSlot('target', 'mon', '09:00', '10:00'), makeSlot('f1', 'mon', '09:00', '10:00')],
  };
}

describe('interestedButUnconvinced', () => {
  it('selects students with I ≥ 0.5 and fit below 75', () => {
    const ctx = context(6);
    expect(interestedButUnconvinced(target, ctx.cohort, ctx.weights, ctx.homeTopics)).toHaveLength(6);
  });
});

// Five modules the keen students rate at fit 41 (I = 0.5, L = 0.4): above the target's 38, below its 42 and 43.
const rivals = Array.from({ length: 5 }, (_, i) =>
  makeModule(`rival-${i}`, {
    topics: { 'fluid-mechanics': 1, languages: 1 },
    demand: { ...target.demand, mathsIntensity: 0.8 },
  }),
);

describe('counterfactuals', () => {
  it('returns positive uplifts only, best first, in plain words', () => {
    const ctx = context(6);
    const results = counterfactuals(target, ctx);
    // Lower maths 0.9 → 0.7: L = 0.5, fit 43 (+5). Add thermodynamics at 0.3: I = 1.3 / 2.3, fit 42 (+4).
    expect(results.map((c) => [c.change, c.uplift])).toEqual([
      [{ kind: 'shift-demand', field: 'mathsIntensity', delta: -0.2 }, 5],
      [{ kind: 'add-topic', topic: 'thermodynamics-energy', weight: 0.3 }, 4],
    ]);
    expect(results.every((c) => c.uplift > 0 && c.groupSize === 6)).toBe(true);
    expect(results.map((c) => c.description)).toEqual([
      'Ease the maths from very demanding to demanding',
      'Add teaching on thermodynamics and energy (about a tenth of the content)',
    ]);
  });

  it('counts students who would newly rank the module in their top five', () => {
    const ctx = { ...context(6), modules: [target, ...rivals] };
    const [maths, thermo] = counterfactuals(target, ctx);
    expect(maths).toMatchObject({ newlyTopModules: 6, alreadyTopModules: 0, crossStrongFit: 0 });
    expect(thermo).toMatchObject({ newlyTopModules: 6, alreadyTopModules: 0 });
  });

  it('counts only modules a student may take towards their top five', () => {
    // Rules that allow the target alone: the rivals no longer compete, so the target is already in the top five.
    const rules = makeRules({ allowedElectiveIds: ['target'] });
    const ctx = { ...context(6), modules: [target, ...rivals], rules };
    const [maths] = counterfactuals(target, ctx);
    expect(maths).toMatchObject({ newlyTopModules: 0, alreadyTopModules: 6 });
  });

  it('leaves completed modules out of a student top five, as their own catalogue does', () => {
    const done = rivals.map((rival) => rival.id);
    const ctx = { ...context(6), modules: [target, ...rivals] };
    ctx.cohort = ctx.cohort.map((student) => ({ ...student, completedModuleIds: done }));
    const [maths] = counterfactuals(target, ctx);
    expect(maths).toMatchObject({ newlyTopModules: 0, alreadyTopModules: 6 });
    // A module the student has completed cannot enter their top five.
    const finished = { ...ctx, cohort: ctx.cohort.map((student) => ({ ...student, completedModuleIds: ['target'] })) };
    expect(counterfactuals(target, { ...finished, modules: [target, ...rivals] })[0]).toMatchObject({ newlyTopModules: 0, alreadyTopModules: 0 });
  });

  it('counts students whose fit would reach 70', () => {
    // I = 1, L = 0.3: fit 68. Lowering maths to 0.7 gives L = 0.5 and fit 73.
    const focused = makeModule('focused', { topics: { 'fluid-mechanics': 1 }, demand: { ...target.demand } });
    const students = Array.from({ length: 5 }, (_, i) =>
      makeProfile({ studentId: `f-${i}`, interests: { 'fluid-mechanics': 1 }, style: { ...makeProfile().style, mathsComfort: 0.2 } }),
    );
    const ctx = { ...context(0), modules: [focused], cohort: students };
    const [best] = counterfactuals(focused, ctx);
    expect(best).toMatchObject({ change: { field: 'mathsIntensity' }, crossStrongFit: 5 });
  });

  it('is blocked for a group under five students', () => {
    expect(counterfactuals(target, context(4))).toEqual([]);
  });
});

describe('plain wording', () => {
  it('names shares of the content and levels in words', () => {
    expect(shareInWords(0.1)).toBe('about a tenth');
    expect(shareInWords(0.3)).toBe('about a third');
    expect(shareInWords(0.03)).toBe('a small part');
    expect(levelInWords(0.9)).toBe('very demanding');
    expect(levelInWords(0.6 - 0.2)).toBe('moderate');
    expect(levelInWords(0.1)).toBe('very light');
  });

  it('describes exam changes as marks moving between exam and coursework', () => {
    const results = counterfactuals({ ...target, demand: { ...target.demand, examShare: 0.6 } }, {
      ...context(6),
      cohort: interested(6).map((s) => ({ ...s, style: { ...s.style, examPreference: 0.2 } })),
    });
    expect(results.map((c) => c.description)).toContain('Move 20% of the marks from the exam to coursework');
  });

  it('puts no raw decimals or internal units in any card', () => {
    const ctx = { ...context(6, Array.from({ length: 6 }, () => ['target', 'f1'])), modules: [target, ...rivals] };
    const cards = [...buildInsights(target, ctx), ...buildInsights({ ...target, capacity: 5 }, ctx)];
    expect(cards.length).toBeGreaterThan(2);
    for (const card of cards) expect(plainWording(card), card.headline).toBe(true);
  });
});

describe('cohortStats', () => {
  it('counts shortlists and buckets fits into ten bands', () => {
    const ctx = context(6, [['target'], ['target', 'f1'], ['f2']]);
    const stats = cohortStats(target, ctx.cohort, ctx.shortlists, ctx.weights, ctx.homeTopics);
    // Uninterested students: I = 0, L neutral 0.5, fit round(100 · 0.1 / 0.75) = 13.
    expect(stats).toEqual({
      cohortSize: 9,
      shortlisted: 2,
      averageFit: 29.7,
      fitHistogram: [0, 3, 0, 6, 0, 0, 0, 0, 0, 0],
    });
  });

  it('is withheld for a cohort under five', () => {
    expect(cohortStats(target, interested(4), [], DEFAULT_WEIGHTS, {})).toBeNull();
  });
});

describe('insight cards', () => {
  it('builds counterfactual cards with deterministic ids that carry the change, and pending decisions', () => {
    const insights = buildInsights(target, context(6));
    const cards = insights.filter((insight) => insight.kind === 'COUNTERFACTUAL');
    expect(cards.map((card) => card.id)).toEqual([
      'target:COUNTERFACTUAL:demand.mathsIntensity=0.7',
      'target:COUNTERFACTUAL:topics.thermodynamics-energy=0.3',
    ]);
    expect(cards.map((card) => suggestedEditOf(card.id))).toEqual([
      { group: 'demand', key: 'mathsIntensity', value: 0.7 },
      { group: 'topics', key: 'thermodynamics-energy', value: 0.3 },
    ]);
    expect(cards[0]).toMatchObject({ moduleId: 'target', cohortSize: 6, upliftPoints: 5, decision: 'pending' });
    expect(cards[0]?.headline).toContain('+5.0 fit points');
    expect(buildInsights(target, context(6))).toEqual(insights);
  });

  it('orders cards by usefulness: real changes, demand, clashes, then the summary', () => {
    const shared = Array.from({ length: 6 }, () => ['target', 'f1']);
    const kinds = (module: typeof target, ctx: InsightContext) =>
      buildInsights(module, ctx).map((card) => (card.upliftPoints === null && card.kind === 'COUNTERFACTUAL' ? 'SUMMARY' : card.kind));
    expect(kinds({ ...target, capacity: 6 }, context(6, shared))).toEqual(['COUNTERFACTUAL', 'COUNTERFACTUAL', 'DEMAND', 'CLASH']);
    // With a light style weight and no topic left to add that the students want, only the summary remains.
    const settled = { ...target, topics: { ...target.topics, 'thermodynamics-energy': 1 }, capacity: 6 };
    const light = { ...context(6, shared), weights: { ...DEFAULT_WEIGHTS, style: 0.03 } };
    expect(kinds(settled, light)).toEqual(['DEMAND', 'CLASH', 'SUMMARY']);
  });

  it('leads with the top-five impact, alongside the average', () => {
    const [card] = buildInsights(target, { ...context(6), modules: [target, ...rivals] });
    expect(card?.headline).toBe(
      'Ease the maths from very demanding to demanding: would move the module into the top five for 6 of the 6 interested students',
    );
    expect(card?.detail).toContain('average fit rises by 5.0 points');
    expect(card?.upliftPoints).toBe(5);
  });

  it('hides changes under two points and keeps the ones above', () => {
    // A light style weight: easing the maths is worth under two points, adding thermodynamics still more.
    const ctx = { ...context(6), weights: { ...DEFAULT_WEIGHTS, style: 0.03 } };
    const cards = counterfactualInsights(target, ctx);
    expect(cards.map((card) => card.headline)).toEqual([expect.stringMatching(/^Add teaching on thermodynamics and energy/)]);
    expect(cards.every((card) => (card.upliftPoints ?? 0) >= MEANINGFUL_UPLIFT)).toBe(true);
  });

  it('merges changes too small to act on into one summary card that names the main gap', () => {
    // Exam share already matches the students and every other topic dilutes what they want: nothing helps.
    const settled = makeModule('settled', {
      topics: { 'fluid-mechanics': 1, 'thermodynamics-energy': 1, languages: 2 },
      demand: { ...target.demand, examShare: 0.5 },
    });
    const students = interested(6).map((s) => ({ ...s, style: { ...makeProfile().style, examPreference: 0.5 } }));
    const cards = counterfactualInsights(settled, { ...context(0), modules: [settled, ...rivals], cohort: students });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: 'settled:COUNTERFACTUAL:summary', kind: 'COUNTERFACTUAL', cohortSize: 6, upliftPoints: null });
    expect(cards[0]?.headline).toBe('No single change makes a big difference; the main gap is topic match');
    expect(cards[0]?.detail).toContain('None of the changes tested raises their fit.');
  });

  it('names the style dimension that holds the module back against the modules students rank higher', () => {
    const examHeavy = makeModule('exam-heavy', { topics: { 'fluid-mechanics': 1, languages: 1 }, demand: { ...target.demand, examShare: 0.9 } });
    const coursework = rivals.map((rival) => ({ ...rival, demand: { ...target.demand, examShare: 0.2 } }));
    const students = Array.from({ length: 5 }, (_, i) =>
      makeProfile({ studentId: `e-${i}`, interests: { 'fluid-mechanics': 1 }, style: { ...makeProfile().style, examPreference: 0.2 } }),
    );
    const ctx = { ...context(0), modules: [examHeavy, ...coursework], cohort: students };
    expect(mainGap(examHeavy, students, ctx).short).toBe('the exam-heavy assessment');
  });

  it('weighs style gaps by what they cost in fit, counting how many style questions each student answered', () => {
    const base = { examShare: 0.2, groupShare: 0.5, applied: 0.5, mathsIntensity: 0.2, codingIntensity: 0.5, workload: 0.5 };
    const topics = { 'fluid-mechanics': 1, languages: 1 };
    const module = makeModule('mixed', { topics, demand: { ...base, examShare: 0.8, mathsIntensity: 0.6 } });
    const others = Array.from({ length: 5 }, (_, i) => makeModule(`plain-${i}`, { topics, demand: base }));
    // Three answered all six questions and mind the exam (0.6 over six answers: 0.1 of style each)...
    const full = Array.from({ length: 3 }, (_, i) =>
      makeProfile({
        studentId: `full-${i}`,
        interests: { 'fluid-mechanics': 1 },
        style: { examPreference: 0.2, groupPreference: 0.5, appliedPreference: 0.5, mathsComfort: 0.6, codingComfort: 0.5, workloadTolerance: 0.5 },
      }),
    );
    // ...two answered only maths and mind it (0.4 over one answer: 0.4 of style each).
    const mathsOnly = Array.from({ length: 2 }, (_, i) =>
      makeProfile({ studentId: `maths-${i}`, interests: { 'fluid-mechanics': 1 }, style: { ...makeProfile().style, mathsComfort: 0.2 } }),
    );
    const group = [...full, ...mathsOnly];
    // Raw penalties favour the exam (3 × 0.6 against 2 × 0.4); in fit points the maths costs more.
    expect(mainGap(module, group, { ...context(0), modules: [module, ...others], cohort: group }).short).toBe('the maths load');
  });

  it('gives an oversubscribed module demand management, not ways to raise fit', () => {
    const full = { ...target, capacity: 5 };
    const ctx = context(6, Array.from({ length: 6 }, () => ['target']));
    const cards = buildInsights(full, ctx);
    expect(cards.filter((card) => card.kind === 'COUNTERFACTUAL')).toEqual([]);
    const card = cards.find((c) => c.kind === 'DEMAND');
    expect(card?.headline).toBe('Oversubscribed: 6 shortlists for 5 places (120%). Manage demand rather than raise fit');
    expect(card?.detail).toContain('add places or a second group');
    expect(card?.detail).toMatch(/such as F\d Module f\d \(average fit \d+ for these students\) and F\d Module f\d \(\d+\)/);
    // Near capacity is not oversubscribed: counterfactual cards still appear.
    expect(buildInsights({ ...target, capacity: 6 }, ctx).some((c) => c.kind === 'COUNTERFACTUAL')).toBe(true);
  });

  it('flags an overlooked module: above-median fit, under 20% of capacity shortlisted', () => {
    const card = overlooked(target, context(6, [['target']]));
    expect(card).toMatchObject({ id: 'target:OVERLOOKED:1', kind: 'OVERLOOKED', cohortSize: 9 });
    expect(card?.detail).toContain('1% of its 100 places');
    const popular = Array.from({ length: 20 }, () => ['target']);
    expect(overlooked(target, context(6, popular))).toBeNull();
  });

  it('flags demand near or over capacity, but not from fewer than five students', () => {
    const small = { ...target, capacity: 5 };
    const five = Array.from({ length: 5 }, () => ['target']);
    expect(demand(small, context(6, five))?.headline).toContain('5 shortlists for 5 places (100%)');
    expect(demand({ ...target, capacity: 4 }, context(6, five.slice(0, 4)))).toBeNull();
  });

  it('reports clash pairs only when five or more students share them', () => {
    const pairs = (n: number) => Array.from({ length: n }, () => ['target', 'f1']);
    const [card, ...rest] = clashInsights(target, context(6, pairs(5)));
    expect(rest).toEqual([]);
    expect(card).toMatchObject({ id: 'target:CLASH:1', kind: 'CLASH', cohortSize: 5 });
    expect(card?.headline).toContain('F1 Module f1');
    expect(clashInsights(target, context(6, pairs(4)))).toEqual([]);
  });

  it('returns no insight at all when the cohort behind it is under five', () => {
    const shortlists = Array.from({ length: 4 }, () => ['target', 'f1']);
    const ctx = { ...context(4, shortlists), cohort: interested(4) };
    expect(buildInsights({ ...target, capacity: 4 }, ctx)).toEqual([]);
  });
});

describe('suggested edits', () => {
  it('round-trip through text and reject anything that is not a known field set to 0 to 1', () => {
    const edit = { group: 'demand', key: 'examShare', value: 0.4 } as const;
    expect(formatSuggestedEdit(edit)).toBe('demand.examShare=0.4');
    expect(parseSuggestedEdit('demand.examShare=0.4')).toEqual(edit);
    expect(parseSuggestedEdit('topics.fluid-mechanics=0.3')).toEqual({ group: 'topics', key: 'fluid-mechanics', value: 0.3 });
    expect(parseSuggestedEdit('topics.not-a-topic=0.3')).toBeNull();
    expect(parseSuggestedEdit('demand.examShare=1.5')).toBeNull();
    expect(parseSuggestedEdit('skills.cad=0.3')).toBeNull();
    expect(suggestedEditOf('target:COUNTERFACTUAL:summary')).toBeNull();
    expect(suggestedEditOf('target:CLASH:1')).toBeNull();
  });

  it('record the value a demand change ends at, kept within 0 to 1', () => {
    const low = { ...target, demand: { ...target.demand, examShare: 0.1 } };
    expect(suggestedEditFor(low, { kind: 'shift-demand', field: 'examShare', delta: -0.2 })).toEqual({ group: 'demand', key: 'examShare', value: 0 });
  });
});

describe('storedDecisions', () => {
  const cards = buildInsights(target, context(6)).filter((card) => card.kind === 'COUNTERFACTUAL');
  const [maths, thermo] = cards;

  it('keeps decisions by id', () => {
    const { decisions, legacyIds } = storedDecisions(cards, [{ ...maths!, decision: 'noted' }]);
    expect(decisions.get(maths!.id)).toBe('noted');
    expect(legacyIds).toEqual([]);
  });

  it('carries a decision from an older rank-based id that names the same change, and hands the old row back', () => {
    // Rank 1 under the old ids, but the change is the thermodynamics one: matched by change, not by rank.
    const legacy = { ...thermo!, id: 'target:COUNTERFACTUAL:1', decision: 'accepted' as const };
    const { decisions, legacyIds } = storedDecisions(cards, [legacy]);
    expect(decisions.get(thermo!.id)).toBe('accepted');
    expect(decisions.has(maths!.id)).toBe(false);
    expect(legacyIds).toEqual(['target:COUNTERFACTUAL:1']);
  });

  it('carries nothing to a different change, even with the same rank and uplift', () => {
    const legacy = { ...maths!, id: 'target:COUNTERFACTUAL:1', headline: 'Move 20% of the marks from the exam to coursework: +5.0 fit points', decision: 'accepted' as const };
    const { decisions, legacyIds } = storedDecisions(cards, [legacy]);
    expect(decisions.has(maths!.id)).toBe(false);
    // Still handed back, so it is deleted and never matches a later card.
    expect(legacyIds).toEqual(['target:COUNTERFACTUAL:1']);
  });

  it('uses each old row once, and lets a decision under the new id win', () => {
    const differentUplift = { ...thermo!, id: 'target:COUNTERFACTUAL:2', upliftPoints: 1.4, decision: 'accepted' as const };
    expect(storedDecisions(cards, [differentUplift]).decisions.has(thermo!.id)).toBe(false);
    const both = [{ ...thermo!, id: 'target:COUNTERFACTUAL:2', decision: 'accepted' as const }, { ...thermo!, decision: 'dismissed' as const }];
    expect(storedDecisions(cards, both).decisions.get(thermo!.id)).toBe('dismissed');
    const twin = { ...thermo!, id: 'other:COUNTERFACTUAL:topics.thermodynamics-energy=0.3' };
    const once = storedDecisions([thermo!, twin], [{ ...thermo!, id: 'target:COUNTERFACTUAL:1', decision: 'noted' as const }]).decisions;
    expect([once.get(thermo!.id), once.get(twin.id)]).toEqual(['noted', undefined]);
  });
});

describe('Insights agent checks', () => {
  const card = buildInsights(target, context(6))[0]!;

  it('rejects a rewrite that changes a number', () => {
    expect(sameNumbers(card, { headline: card.headline, detail: card.detail })).toBe(true);
    expect(sameNumbers(card, { headline: card.headline.replace('5.0', '7.0'), detail: card.detail })).toBe(false);
  });

  it('rejects a rewrite that brings back internal units or raw 0-to-1 values', () => {
    expect(plainWording({ headline: card.headline, detail: card.detail })).toBe(true);
    expect(plainWording({ headline: 'Lower maths intensity from 0.90 to 0.70', detail: '' })).toBe(false);
    expect(plainWording({ headline: 'Add thermodynamics at topic weight 0.3', detail: '' })).toBe(false);
    expect(plainWording({ headline: 'Students with interest alignment of at least half', detail: '' })).toBe(false);
  });
});
