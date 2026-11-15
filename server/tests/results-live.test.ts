// Spec 23 live paths with a mocked model: tailored feedback keeps only numbers that are in the facts, a slow AI draft
// never overwrites an examiner's newer save.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/agents/llm.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/agents/llm.ts')>()),
  isLive: () => true,
  structured: vi.fn(),
}));

const { structured } = await import('../src/agents/llm.ts');
const { tailoredFeedback } = await import('../src/agents/exam-feedback.ts');
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
