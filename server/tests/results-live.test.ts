// Spec 23 live paths with a mocked model: tailored feedback keeps only numbers that are in the facts, a slow AI draft
// never overwrites an examiner's newer save, and a live explanation always ends with the performance nudge.
import { schemas as S, type StudentProfile } from '@modulematch/shared';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/agents/llm.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/agents/llm.ts')>()),
  isLive: () => true,
  structured: vi.fn(),
}));

const { structured } = await import('../src/agents/llm.ts');
const { tailoredFeedback } = await import('../src/agents/exam-feedback.ts');
const { explain } = await import('../src/agents/matcher.ts');
const { createApp } = await import('../src/app.ts');
const { seedIfEmpty } = await import('../src/bootstrap.ts');
const { dataPath } = await import('../src/db/datasets.ts');
const repo = await import('../src/db/repo.ts');
const { examFacts, parseTranscript, templateFeedback } = await import('../src/engines/index.ts');

const mocked = vi.mocked(structured);
const tracer = { record: (e: unknown) => e, timed: async <T>(_e: unknown, fn: () => Promise<T>) => fn() } as unknown as Parameters<typeof tailoredFeedback>[1];

beforeAll(() => {
  seedIfEmpty();
});

const facts = () => {
  const result = parseTranscript(readFileSync(dataPath('demo/synthetic-transcript.txt'), 'utf8'), repo.listModules()).results.find((r) => r.moduleId === 'MECH50010')!;
  return examFacts(repo.getExamForm('MECH50010')!, result, repo.listModules())!;
};

const reply = (overall: string, advice: string) => ({
  overall,
  strengths: ['Q1 went well at 15 out of 20.'],
  weakPoints: [
    { questionId: 'Q3', advice },
    { questionId: 'Q5', advice: 'Check whether the throat is choked first.' },
  ],
  revisionPlan: ['Rework the boundary-layer derivation.', 'Do 37 extra nozzle problems.'],
  affectsModules: [{ moduleId: 'MECH60006', note: 'Fluid Mechanics 3A builds directly on this.' }],
});

describe('live tailored feedback', () => {
  it('keeps model wording whose numbers all come from the facts, and keeps code-computed numbers', async () => {
    mocked.mockResolvedValueOnce(reply('You scored 57, losing most marks on Q3 (6 out of 20).', 'Revise the Blasius result before the thickness definitions.'));
    const f = facts();
    const out = await tailoredFeedback(f, tracer);
    expect(out.source).toBe('model');
    expect(out.overall).toBe('You scored 57, losing most marks on Q3 (6 out of 20).');
    expect(out.weakPoints.map((w) => [w.questionId, w.lostMarks])).toEqual([
      ['Q3', 14],
      ['Q5', 9],
    ]);
    expect(out.affectsModules.map((a) => a.moduleId)).toEqual(f.affects.map((a) => a.moduleId));
  });

  it('falls back to the template wording for any field that states a number not in the facts', async () => {
    mocked.mockResolvedValueOnce(reply('You scored 75 on this exam.', 'You lost 17 marks here.'));
    const f = facts();
    const template = templateFeedback(f);
    const out = await tailoredFeedback(f, tracer);
    expect(out.overall).toBe(template.overall);
    expect(out.weakPoints[0]!.advice).toBe(template.weakPoints[0]!.advice);
    expect(out.revisionPlan).toEqual(['Rework the boundary-layer derivation.']);
  });
});

describe('live exam form drafts', () => {
  it('does not overwrite a form an examiner saved while the draft was being written', async () => {
    const app = createApp();
    let finish: (v: unknown) => void = () => {};
    mocked.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const notes = 'Q1 (20 marks) Kinematics. Many forgot the Coriolis term.';
    const pending = app.request('/api/staff/modules/MECH50001/exam-form/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ examLabel: '2026 (synthetic)', notes }),
    });
    await vi.waitFor(() => expect(mocked).toHaveBeenCalled());
    const question = { id: 'Q1', label: 'Q1: Conduction', maxMarks: 20, topics: ['thermodynamics-energy'], whatGoodAnswersDid: '', commonMistakes: [], revisionPointers: [] };
    const saved = await app.request('/api/staff/modules/MECH50001/exam-form', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ examLabel: 'Examiner version', questions: [question], generalComments: '' }),
    });
    expect(saved.status).toBe(200);
    finish({ questions: [{ ...question, label: 'AI version' }], generalComments: '' });
    expect((await pending).status).toBe(409);
    expect(repo.getExamForm('MECH50001')).toMatchObject({ examLabel: 'Examiner version', authoredBy: 'examiner' });
  });
});

describe('live explanation with a performance nudge', () => {
  const profile = (): StudentProfile =>
    S.StudentProfile.parse({
      studentId: 's',
      programme: 'MEng Mechanical Engineering',
      yearOfStudy: 3,
      completedModuleIds: [],
      interests: {},
      pathways: [],
      pathwaysSkipped: false,
      style: { examPreference: null, groupPreference: null, appliedPreference: null, mathsComfort: null, codingComfort: null, workloadTolerance: null },
      breadthAppetite: null,
      timetablePrefs: { avoidDays: [], earliestStart: null },
      completeness: 0,
      updatedAt: '2026-11-14T00:00:00.000Z',
    });
  const rec = () => S.Recommendation.parse({ moduleId: 'MECH60006', fit: 55, sub: { interest: 0.5, goal: null, style: 0.7, breadth: 0.5 }, eligible: true, ineligibleReasons: [], confidence: 'medium' });
  const nudge = { moduleId: 'MECH60006', topics: ['fluid-mechanics'], delta: -8.7, message: 'Fluid Mechanics 3A leans on fluid mechanics. Worth keeping in mind.' };
  const live = (performanceWatchOut: string | null) => ({
    summary: 'A good fit.',
    because: [{ text: 'It is mainly about fluid mechanics.', evidenceId: null, moduleField: 'topics.fluid-mechanics' }],
    watchOuts: ['It needs a strong grounding in fluid mechanics.'],
    performanceWatchOut,
  });

  it("ends with the model's own nudge sentence, even when another watch-out mentions the topic", async () => {
    mocked.mockResolvedValueOnce(live('Your fluid mechanics results suggest some early revision would help.'));
    const out = await explain(profile(), repo.getModule('MECH60006')!, rec(), [], tracer, nudge);
    expect(out.watchOuts.at(-1)).toBe('Your fluid mechanics results suggest some early revision would help.');
  });

  it('falls back to the deterministic nudge when the model leaves it out', async () => {
    mocked.mockResolvedValueOnce(live(null));
    const out = await explain(profile(), repo.getModule('MECH60006')!, rec(), [], tracer, nudge);
    expect(out.watchOuts).toEqual(['It needs a strong grounding in fluid mechanics.', nudge.message]);
  });
});
