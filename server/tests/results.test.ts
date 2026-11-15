// Spec 23: consented results upload, the transcript parser, performance nudges (which never change scores), examiner
// feedback forms (drafts hidden from students) and tailored exam feedback on the offline template path.
import { RESULTS_BASE64_MAX, RESULTS_BODY_MAX_BYTES, schemas as S, type ExamFeedbackForm, type Module, type ModuleResult, type StudentResults } from '@modulematch/shared';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { heuristicDraft, uniqueIds } from '../src/agents/exam-feedback.ts';
import { createApp } from '../src/app.ts';
import { TOO_LARGE } from '../src/routes/results.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { dataPath } from '../src/db/datasets.ts';
import * as repo from '../src/db/repo.ts';
import { examFacts, NUDGE_THRESHOLD, parseTranscript, performanceView, templateFeedback } from '../src/engines/index.ts';

const app = createApp();
const send = (method: string, b: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const json = (b: unknown) => send('POST', b);
const demoTranscript = readFileSync(dataPath('demo/synthetic-transcript.txt'), 'utf8');

async function newSession(): Promise<string> {
  const res = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
  return S.SessionState.parse(await res.json()).id;
}

const upload = (id: string, body: unknown) => app.request(`/api/sessions/${id}/results`, json(body));

beforeAll(() => {
  seedIfEmpty();
});

// ---------- parser ----------

describe('transcript parser', () => {
  const catalogue = () => repo.listModules();

  it('reads the synthetic demo transcript, with question marks on the line after the module', () => {
    const parsed = parseTranscript(demoTranscript, catalogue());
    expect(parsed.problems).toEqual([]);
    expect(parsed.unmatched).toEqual(['DESE50002']);
    expect(parsed.results).toHaveLength(15);
    const fm2 = parsed.results.find((r) => r.moduleId === 'MECH50010')!;
    expect(fm2).toMatchObject({ code: 'MECH50010', title: 'Fluid Mechanics 2', mark: 57, matched: true, source: 'pasted-text' });
    expect(fm2.questionMarks.map((q) => [q.questionId, q.mark, q.maxMarks])).toEqual([
      ['Q1', 15, 20],
      ['Q2', 13, 20],
      ['Q3', 6, 20],
      ['Q4', 12, 20],
      ['Q5', 11, 20],
    ]);
  });

  it('tolerates percentages, tabs, CSV with a header, "/100", title-only rows and lower-case codes', () => {
    const text = [
      'Code,Title,Mark,ECTS',
      'MECH50010,Fluid Mechanics 2,62,7.5',
      'MECH50006\tThermodynamics 2\t65%',
      'Stress Analysis 2 58',
      'mech50003 mathematics and computing 2 - 71/100',
    ].join('\n');
    const marks = Object.fromEntries(parseTranscript(text, catalogue()).results.map((r) => [r.moduleId, r.mark]));
    expect(marks).toEqual({ MECH50010: 62, MECH50006: 65, MECH50002: 58, MECH50003: 71 });
  });

  it('reads question breakdowns on the module line, and uses their total when no overall mark is given', () => {
    const [r] = parseTranscript('MECH50010 Fluid Mechanics 2 Q1 15/20 Q2: 10/20 Q3 5 / 20', catalogue()).results;
    expect(r!.questionMarks).toHaveLength(3);
    expect(r!.mark).toBe(50);
  });

  it('keeps unknown codes as unmatched results and lists them', () => {
    const parsed = parseTranscript('XYZ12345 Underwater Basket Weaving 55\nMECH50010 Fluid Mechanics 2 62', catalogue());
    expect(parsed.unmatched).toEqual(['XYZ12345']);
    expect(parsed.results.find((r) => r.code === 'XYZ12345')).toMatchObject({ moduleId: 'XYZ12345', matched: false, mark: 55, title: 'Underwater Basket Weaving' });
  });

  it('never matches an unknown code by its title, so it cannot replace a real result', () => {
    const parsed = parseTranscript('MECH50010 Fluid Mechanics 2 62\nXYZ12345 Fluid Mechanics 2 55', catalogue());
    expect(parsed.unmatched).toEqual(['XYZ12345']);
    expect(parsed.results.find((r) => r.moduleId === 'MECH50010')?.mark).toBe(62);
    expect(parsed.results.find((r) => r.moduleId === 'XYZ12345')).toMatchObject({ matched: false, mark: 55 });
  });

  it('reports a question mark above its maximum, or a mark above 100, instead of storing it', () => {
    const parsed = parseTranscript('MECH50010 Fluid Mechanics 2 62\nQ1 25/20\nMECH50006 Thermodynamics 2 120', catalogue());
    expect(parsed.results).toEqual([]);
    expect(parsed.problems).toHaveLength(2);
    expect(parsed.problems[0]).toMatch(/Q1 shows 25\/20/);
  });

  it('ignores header, year and average lines', () => {
    const parsed = parseTranscript('Student: Demo (synthetic)\nYear 2 (2025-26)\nYear 2 average 67.3\nMECH50008 Dynamics 68', catalogue());
    expect(parsed.results.map((r) => r.moduleId)).toEqual(['MECH50008']);
  });
});

// ---------- upload routes ----------

describe('results routes', () => {
  it('requires consent with every upload', async () => {
    const id = await newSession();
    expect((await upload(id, { text: demoTranscript })).status).toBe(400);
    expect((await upload(id, { consent: false, text: demoTranscript })).status).toBe(400);
    expect(repo.getResults(id).results).toEqual([]);
  });

  it('stores pasted text with consent, and traces counts but never marks', async () => {
    const id = await newSession();
    const res = await upload(id, { consent: true, text: demoTranscript });
    expect(res.status).toBe(200);
    const body = S.ResultsUploadResponse.parse(await res.json());
    expect(body.source).toBe('parser');
    expect(body.unmatched).toEqual(['DESE50002']);
    expect(body.results.consent.granted).toBe(true);
    expect(body.results.results).toHaveLength(15);
    const got = S.StudentResults.parse(await (await app.request(`/api/sessions/${id}/results`)).json());
    expect(got.results.find((r) => r.moduleId === 'MECH50010')?.mark).toBe(57);
    const trace = repo.listTraceEvents(id).filter((e) => /results|G3/.test(e.actor));
    expect(trace.length).toBeGreaterThan(0);
    for (const e of trace) expect(`${e.input} ${e.output}`).not.toMatch(/\b57\b|\d+\/\d+|%/);
  });

  it('asks for pasted text when a file arrives in offline mode', async () => {
    const id = await newSession();
    const res = await upload(id, { consent: true, file: { mediaType: 'application/pdf', base64: 'JVBERi0xLjQK' } });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/paste the text/i);
  });

  it('refuses a body over the size limit with a friendly 413, before reading it', async () => {
    const id = await newSession();
    const base64 = 'A'.repeat(RESULTS_BODY_MAX_BYTES);
    const res = await upload(id, { consent: true, file: { mediaType: 'application/pdf', base64 } });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: TOO_LARGE });
    expect(TOO_LARGE).toMatch(/3 MB/);
  });

  it('caps a file at 3 MB of base64, under the 4.5 MB request limit Vercel allows', () => {
    const file = (base64: string) => S.ResultsUploadBody.safeParse({ consent: true, file: { mediaType: 'application/pdf', base64 } }).success;
    expect(RESULTS_BASE64_MAX).toBe(4_000_000);
    expect(file('A'.repeat(RESULTS_BASE64_MAX))).toBe(true);
    expect(file('A'.repeat(RESULTS_BASE64_MAX + 4))).toBe(false);
    expect(RESULTS_BODY_MAX_BYTES).toBeLessThan(4_500_000);
  });

  it('rejects impossible marks with a clear message and stores nothing', async () => {
    const id = await newSession();
    const res = await upload(id, { consent: true, text: 'MECH50010 Fluid Mechanics 2 62\nQ3 21/20' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/cannot be above its maximum/);
    expect(repo.getResults(id).consent.granted).toBe(false);
  });

  it('withdrawing consent deletes every mark', async () => {
    const id = await newSession();
    await upload(id, { consent: true, text: demoTranscript });
    const res = await app.request(`/api/sessions/${id}/results`, { method: 'DELETE' });
    const cleared = S.StudentResults.parse(await res.json());
    expect(cleared).toEqual({ consent: { granted: false, at: null }, results: [], updatedAt: null });
    const perf = S.PerformanceView.parse(await (await app.request(`/api/sessions/${id}/performance`)).json());
    expect(perf).toEqual({ consent: false, overallAverage: null, topics: [], nudges: [] });
    expect(await (await app.request(`/api/sessions/${id}/exam-feedback`)).json()).toEqual([]);
  });

  it('deleting the profile deletes every mark too', async () => {
    const id = await newSession();
    await upload(id, { consent: true, text: demoTranscript });
    await app.request(`/api/sessions/${id}/profile`, { method: 'DELETE' });
    expect(repo.getResults(id)).toEqual({ consent: { granted: false, at: null }, results: [], updatedAt: null });
  });
});

// ---------- performance engine ----------

const mod = (id: string, topics: Record<string, number>, extra: Partial<Module> = {}): Module => ({
  ...repo.getModule('MECH50010')!,
  id,
  code: id,
  title: `Module ${id}`,
  topics,
  prerequisites: [],
  ...extra,
});

const result = (moduleId: string, mark: number, questionMarks: ModuleResult['questionMarks'] = []): ModuleResult => ({
  moduleId,
  code: moduleId,
  title: null,
  mark,
  questionMarks,
  matched: true,
  source: 'manual',
});

const held = (results: ModuleResult[]): StudentResults => ({ consent: { granted: true, at: '2026-11-14T00:00:00.000Z' }, results, updatedAt: '2026-11-14T00:00:00.000Z' });

describe('performance engine', () => {
  const modules = [
    mod('FLUIDS', { 'fluid-mechanics': 1 }),
    mod('THERMO', { 'thermodynamics-energy': 1 }),
    mod('MIXED', { 'fluid-mechanics': 0.5, 'thermodynamics-energy': 0.5 }),
    mod('NEXT-FLUIDS', { 'fluid-mechanics': 0.5 }),
    mod('LIGHT-FLUIDS', { 'fluid-mechanics': 0.49, 'design-manufacturing': 0.9 }),
    mod('NEXT-THERMO', { 'thermodynamics-energy': 0.9 }),
  ];

  it('computes topic-weighted averages and deltas against the student own average', () => {
    const view = performanceView(held([result('FLUIDS', 50), result('THERMO', 70), result('MIXED', 60)]), modules);
    expect(view.overallAverage).toBe(60);
    const fluids = view.topics.find((t) => t.topic === 'fluid-mechanics')!;
    // (1 * 50 + 0.5 * 60) / 1.5
    expect(fluids.average).toBeCloseTo(53.3, 1);
    expect(fluids.delta).toBeCloseTo(-6.7, 1);
    expect(fluids.modules).toEqual(['FLUIDS', 'MIXED']);
    expect(view.topics.find((t) => t.topic === 'thermodynamics-energy')!.delta).toBeCloseTo(6.7, 1);
  });

  it('nudges modules whose main topics (weight 0.5 or more) are weak, skipping modules already taken', () => {
    const view = performanceView(held([result('FLUIDS', 50), result('THERMO', 70), result('MIXED', 60)]), modules, { interests: { 'fluid-mechanics': 0.8 } });
    expect(view.nudges.map((n) => n.moduleId)).toEqual(['NEXT-FLUIDS']);
    const [nudge] = view.nudges;
    expect(nudge!.topics).toEqual(['fluid-mechanics']);
    expect(nudge!.message).toMatch(/Module NEXT-FLUIDS/);
    expect(nudge!.message).toMatch(/fluid mechanics/);
    expect(nudge!.message).toMatch(/interested/);
    expect(nudge!.message).not.toMatch(/avoid (it|this)\b(?!,)/i);
  });

  it('nudges at exactly the threshold and not just above it', () => {
    // Overall average 60; fluids average 55 (exactly 5 below) nudges; 55.2 does not.
    const at = performanceView(held([result('FLUIDS', 55), result('THERMO', 65)]), modules);
    expect(at.topics.find((t) => t.topic === 'fluid-mechanics')!.delta).toBe(-NUDGE_THRESHOLD);
    expect(at.nudges.map((n) => n.moduleId)).toContain('NEXT-FLUIDS');
    const above = performanceView(held([result('FLUIDS', 55.2), result('THERMO', 64.8)]), modules);
    expect(above.nudges).toEqual([]);
  });

  it('ignores unmatched results and returns an empty view without consent', () => {
    const unmatched = { ...result('XYZ12345', 10), matched: false };
    const view = performanceView(held([result('FLUIDS', 60), unmatched]), modules);
    expect(view.overallAverage).toBe(60);
    expect(performanceView({ consent: { granted: false, at: null }, results: [], updatedAt: null }, modules)).toEqual({ consent: false, overallAverage: null, topics: [], nudges: [] });
  });
});

describe('nudges never change fit scores or rankings', () => {
  it('returns identical recommendations before and after an upload, and shows each nudge once, never in the explanation', async () => {
    const id = await newSession();
    await app.request(`/api/sessions/${id}/profile`, send('PUT', { interests: { 'fluid-mechanics': 0.9 } }));
    const before = await (await app.request(`/api/sessions/${id}/recommendations`)).json();
    await upload(id, { consent: true, text: demoTranscript });
    const after = await (await app.request(`/api/sessions/${id}/recommendations`)).json();
    expect(after).toEqual(before);

    const perf = S.PerformanceView.parse(await (await app.request(`/api/sessions/${id}/performance`)).json());
    expect(perf.consent).toBe(true);
    const nudge = perf.nudges.find((n) => n.moduleId === 'MECH60006');
    expect(nudge?.message).toMatch(/fluid mechanics/i);
    expect(perf.nudges.map((n) => n.moduleId)).not.toContain('MECH50010');

    // One nudge per module in the performance view, which is the only place the module page reads it from.
    expect(perf.nudges.filter((n) => n.moduleId === 'MECH60006')).toHaveLength(1);
    const res = await app.request(`/api/sessions/${id}/modules/MECH60006/explanation`);
    const { explanation } = S.ExplanationResponse.parse(await res.json());
    expect(JSON.stringify(explanation)).not.toContain(nudge!.message);
    expect(explanation.watchOuts.some((w) => /below (your|their) (own )?average/i.test(w))).toBe(false);
  });
});

// ---------- exam forms ----------

describe('exam forms (staff)', () => {
  it('returns null for a module without a form and 404 for an unknown module', async () => {
    expect(await (await app.request('/api/staff/modules/MECH50008/exam-form')).json()).toBeNull();
    expect((await app.request('/api/staff/modules/NOPE/exam-form')).status).toBe(404);
  });

  it('drafts a form from notes offline by splitting on Q1, Q2, with unique ids and taxonomy topics', async () => {
    const notes = readFileSync(dataPath('demo/synthetic-marking-notes.txt'), 'utf8');
    const res = await app.request('/api/staff/modules/MECH50008/exam-form/draft', json({ examLabel: '2026 exam (synthetic)', notes }));
    const form = S.ExamFeedbackForm.parse(await res.json());
    expect(form).toMatchObject({ moduleId: 'MECH50008', status: 'draft', authoredBy: 'ai-draft', examLabel: '2026 exam (synthetic)' });
    expect(form.questions.map((q) => [q.id, q.maxMarks])).toEqual([
      ['Q1', 20],
      ['Q2', 25],
      ['Q3', 25],
      ['Q4', 30],
    ]);
    expect(form.questions[2]!.commonMistakes.join(' ')).toMatch(/damped and undamped/);
    expect(form.questions[0]!.revisionPointers.join(' ')).toMatch(/polar coordinates/);
  });

  it('de-duplicates repeated question ids in a draft', () => {
    const module = repo.getModule('MECH50008')!;
    const draft = heuristicDraft('Q1 (10 marks) Kinematics. Many forgot units. Q1 (10 marks) Kinetics again.', module);
    expect(draft.questions.map((q) => q.id)).toEqual(['Q1', 'Q1-2']);
    expect(uniqueIds(draft.questions).map((q) => q.id)).toEqual(['Q1', 'Q1-2']);
  });

  it('an examiner save makes the form a draft, hidden from students until it is published', async () => {
    const id = await newSession();
    await upload(id, { consent: true, text: demoTranscript });
    const feedbackModules = async () => ((await (await app.request(`/api/sessions/${id}/exam-feedback`)).json()) as { moduleId: string }[]).map((f) => f.moduleId);
    expect(await feedbackModules()).toContain('MECH50010');

    const current = S.ExamFeedbackForm.parse(await (await app.request('/api/staff/modules/MECH50010/exam-form')).json());
    const { examLabel, questions, generalComments } = current;
    const saved = S.ExamFeedbackForm.parse(await (await app.request('/api/staff/modules/MECH50010/exam-form', send('PUT', { examLabel, questions, generalComments: `${generalComments} Edited.` }))).json());
    expect(saved).toMatchObject({ status: 'draft', authoredBy: 'examiner' });
    expect(await feedbackModules()).not.toContain('MECH50010');

    const published = S.ExamFeedbackForm.parse(await (await app.request('/api/staff/modules/MECH50010/exam-form/publish', json({}))).json());
    expect(published.status).toBe('published');
    expect(await feedbackModules()).toContain('MECH50010');
  });

  it('rejects a save with duplicate question ids', async () => {
    const current = S.ExamFeedbackForm.parse(await (await app.request('/api/staff/modules/MECH50010/exam-form')).json());
    const questions = [current.questions[0]!, current.questions[0]!];
    const res = await app.request('/api/staff/modules/MECH50010/exam-form', send('PUT', { examLabel: current.examLabel, questions, generalComments: '' }));
    expect(res.status).toBe(400);
  });
});

// ---------- tailored feedback ----------

describe('tailored exam feedback', () => {
  const fm2Form = (): ExamFeedbackForm => repo.getExamForm('MECH50010')!;
  const fm2Result = () => parseTranscript(demoTranscript, repo.listModules()).results.find((r) => r.moduleId === 'MECH50010')!;

  it('computes the facts in code: lost marks, weakest questions, the examiner notes and affected modules', () => {
    const facts = examFacts(fm2Form(), fm2Result(), repo.listModules(), ['MECH40002'])!;
    expect(facts.weak.map((q) => [q.questionId, q.lostMarks])).toEqual([
      ['Q3', 14],
      ['Q5', 9],
    ]);
    expect(facts.weak[0]!.commonMistakes.join(' ')).toMatch(/displacement thickness/);
    expect(facts.strong.map((q) => q.questionId)).toEqual(['Q1']);
    // Fluid Mechanics 3A lists Fluid Mechanics 2 as a prerequisite, so it comes first.
    expect(facts.affects[0]).toMatchObject({ moduleId: 'MECH60006', reason: 'prerequisite' });
    expect(facts.affects.map((a) => a.moduleId)).toContain('MECH70015');
    expect(facts.affects.map((a) => a.moduleId)).not.toContain('MECH50010');
  });

  it('returns null when the student has no marks for the form questions', () => {
    expect(examFacts(fm2Form(), { ...fm2Result(), questionMarks: [{ questionId: 'Q9', mark: 1, maxMarks: 2 }] }, repo.listModules())).toBeNull();
  });

  it('builds template feedback from the facts offline', async () => {
    const template = templateFeedback(examFacts(fm2Form(), fm2Result(), repo.listModules())!);
    expect(S.TailoredFeedback.safeParse(template).success).toBe(true);
    expect(template.source).toBe('template');
    expect(template.weakPoints[0]).toMatchObject({ questionId: 'Q3', lostMarks: 14, topics: ['fluid-mechanics', 'mathematics-modelling'] });
    expect(template.weakPoints[0]!.advice).toMatch(/Blasius/);
    expect(template.revisionPlan.length).toBeGreaterThan(0);

    const id = await newSession();
    await upload(id, { consent: true, text: demoTranscript });
    const items = (await (await app.request(`/api/sessions/${id}/exam-feedback`)).json()) as unknown[];
    const parsed = items.map((i) => S.TailoredFeedback.parse(i));
    expect(parsed.map((f) => f.moduleId).sort()).toEqual(['MECH50002', 'MECH50003', 'MECH50006', 'MECH50010']);
    expect(parsed.every((f) => f.source === 'template')).toBe(true);
    // Exam feedback for a student who uploaded no question marks is empty.
    const other = await newSession();
    await upload(other, { consent: true, text: 'MECH50010 Fluid Mechanics 2 62' });
    expect(await (await app.request(`/api/sessions/${other}/exam-feedback`)).json()).toEqual([]);
  });
});

// ---------- the shipped demo round trip (issues #108 and #109) ----------

describe('exam feedback demo round trip', () => {
  const notes = readFileSync(dataPath('demo/synthetic-marking-notes.txt'), 'utf8');

  it('drafts clean fields from the demo notes offline: no labels, no banner, the module’s own topics', () => {
    const draft = heuristicDraft(notes, repo.getModule('MECH50008')!);
    expect(draft).toEqual({
      generalComments: 'Overall the paper was answered well. Free-body diagrams were the main thing separating strong and weak scripts.',
      questions: [
        {
          id: 'Q1',
          label: 'Q1: Particle kinematics in polar coordinates',
          maxMarks: 20,
          topics: ['mathematics-modelling', 'solid-mechanics-materials'],
          whatGoodAnswersDid: 'Wrote the acceleration components carefully, including the Coriolis term.',
          commonMistakes: ['Forgot the 2 r-dot theta-dot term'],
          revisionPointers: ['Revise the derivation of velocity and acceleration in polar coordinates'],
        },
        {
          id: 'Q2',
          label: 'Q2: Rigid body dynamics of a rolling wheel',
          maxMarks: 25,
          topics: ['mathematics-modelling', 'solid-mechanics-materials'],
          whatGoodAnswersDid: 'Drew a free-body diagram and took moments about the contact point.',
          commonMistakes: ['Assuming rolling without slip when friction was not large enough', 'Sign errors in the moment equation'],
          revisionPointers: ['Work through the rolling and slipping tutorial sheet'],
        },
        {
          id: 'Q3',
          label: 'Q3: Single degree of freedom vibration with damping',
          maxMarks: 25,
          topics: ['solid-mechanics-materials', 'control-robotics'],
          whatGoodAnswersDid: 'Found the damping ratio first and identified the regime.',
          commonMistakes: ['Confused the damped and undamped natural frequencies'],
          revisionPointers: ['Practise the logarithmic decrement examples from lecture 9'],
        },
        {
          id: 'Q4',
          label: 'Q4: Energy and momentum methods for a collision',
          maxMarks: 30,
          topics: ['solid-mechanics-materials'],
          whatGoodAnswersDid: 'Chose conservation of momentum for the impact and energy for the motion after it.',
          commonMistakes: ['Applied energy conservation across the impact'],
          revisionPointers: ['Review the coefficient of restitution problems in the notes'],
        },
      ],
    });
  });

  it('the demo transcript carries Dynamics question marks that match the notes', () => {
    const dynamics = parseTranscript(demoTranscript, repo.listModules()).results.find((r) => r.moduleId === 'MECH50008')!;
    expect(dynamics.questionMarks.map((q) => [q.questionId, q.maxMarks])).toEqual([
      ['Q1', 20],
      ['Q2', 25],
      ['Q3', 25],
      ['Q4', 30],
    ]);
    expect(readFileSync(dataPath('demo/synthetic-transcript.html'), 'utf8')).toContain('Q2 14/25');
  });

  it('closes the loop: publish the Dynamics draft and the student gets clean, tailored feedback', async () => {
    const id = await newSession();
    await upload(id, { consent: true, text: demoTranscript });
    // A student with only an overall Dynamics mark is told what would unlock the feedback.
    const bare = await newSession();
    await upload(bare, { consent: true, text: 'MECH50008 Dynamics 68\nMECH50010 Fluid Mechanics 2 57' });
    const awaiting = async (sid: string) =>
      S.ExamAwaitingMarks.array().parse(await (await app.request(`/api/sessions/${sid}/exam-feedback/awaiting-marks`)).json());

    await app.request('/api/staff/modules/MECH50008/exam-form/draft', json({ examLabel: '2026 exam (synthetic)', notes }));
    // Drafts are never shown to students, nor announced.
    expect((await awaiting(bare)).map((a) => a.moduleId)).not.toContain('MECH50008');
    expect((await app.request('/api/staff/modules/MECH50008/exam-form/publish', json({}))).status).toBe(200);

    const feedback = S.TailoredFeedback.array().parse(await (await app.request(`/api/sessions/${id}/exam-feedback`)).json());
    const dynamics = feedback.find((f) => f.moduleId === 'MECH50008');
    expect(dynamics?.weakPoints.map((w) => w.questionId)).toEqual(['Q2']);
    const text = JSON.stringify(dynamics);
    expect(text).not.toMatch(/\.\.|common mistakes:\s*common mistakes|good answers:?\s*(best|good|strong) answers/i);
    expect(text).toContain('Good answers drew a free-body diagram');
    const levels = new Map(repo.listModules().map((m) => [m.id, m.level]));
    expect(dynamics!.affectsModules.length).toBeGreaterThan(0);
    for (const a of dynamics!.affectsModules) expect(levels.get(a.moduleId)).toBeGreaterThan(2);
    expect((await awaiting(id)).map((a) => a.moduleId)).not.toContain('MECH50008');

    expect(await awaiting(bare)).toContainEqual({ moduleId: 'MECH50008', examLabel: '2026 exam (synthetic)', questionIds: ['Q1', 'Q2', 'Q3', 'Q4'] });
  });
});
