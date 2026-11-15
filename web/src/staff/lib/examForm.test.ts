import { schemas } from '@modulematch/shared';
import type { ExamFeedbackForm, Module } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import {
  affectedModules,
  blankDraft,
  blankQuestion,
  draftFromForm,
  draftIssues,
  examStatus,
  exampleNotes,
  fieldId,
  moveItem,
  previewFeedback,
  sameDraft,
  saveBody,
} from './examForm.ts';
import type { ExamDraft } from './examForm.ts';

const form: ExamFeedbackForm = {
  id: 'form-1',
  moduleId: 'fluids-2',
  examLabel: 'Summer 2026 written exam',
  questions: [
    {
      id: 'Q1',
      label: 'Control volumes',
      maxMarks: 20,
      topics: ['fluid-mechanics'],
      whatGoodAnswersDid: 'Drew the control volume first',
      commonMistakes: ['Forgot the pressure term'],
      revisionPointers: ['Problem sheet 2'],
    },
    {
      id: 'Q2',
      label: 'Pipe flow',
      maxMarks: 30,
      topics: ['fluid-mechanics', 'mathematics-modelling'],
      whatGoodAnswersDid: 'Checked the Reynolds number before choosing a friction factor.',
      commonMistakes: ['Used laminar friction for turbulent flow', 'No units'],
      revisionPointers: ['Worked examples 4.2 to 4.5'],
    },
  ],
  generalComments: 'Time management was an issue.',
  status: 'draft',
  authoredBy: 'ai-draft',
  updatedAt: '2026-11-14T10:00:00.000Z',
};

const mod = (id: string, topics: Record<string, number>, prerequisites: string[] = []): Module =>
  ({ id, code: id.toUpperCase(), title: `Module ${id}`, topics, prerequisites }) as unknown as Module;

describe('exam form drafts', () => {
  it('round-trips a server form into a valid save body', () => {
    const body = saveBody(draftFromForm(form));
    expect(schemas.ExamFormSaveBody.safeParse(body).success).toBe(true);
    expect(body.questions.map((q) => q.id)).toEqual(['Q1', 'Q2']);
    expect(body.questions[1]?.maxMarks).toBe(30);
  });

  it('numbers question ids by position, so they stay unique after reorder and delete', () => {
    const draft = draftFromForm(form);
    const reordered: ExamDraft = { ...draft, questions: moveItem(draft.questions, 0, 1) };
    const body = saveBody(reordered);
    expect(body.questions.map((q) => [q.id, q.label])).toEqual([
      ['Q1', 'Pipe flow'],
      ['Q2', 'Control volumes'],
    ]);
    const added = saveBody({ ...reordered, questions: [...reordered.questions, { ...blankQuestion(), maxMarks: '5' }] });
    expect(new Set(added.questions.map((q) => q.id)).size).toBe(3);
    expect(schemas.ExamFormSaveBody.safeParse(added).success).toBe(true);
  });

  it('trims text, drops blank list rows and falls back to a numbered label', () => {
    const draft = blankDraft('  Mock exam ');
    draft.questions[0] = {
      ...draft.questions[0]!,
      maxMarks: '12',
      commonMistakes: ['  sign error ', '', '   '],
      revisionPointers: [''],
    };
    const body = saveBody(draft);
    expect(body.examLabel).toBe('Mock exam');
    expect(body.questions[0]).toMatchObject({ label: 'Question 1', commonMistakes: ['sign error'], revisionPointers: [] });
  });

  it('flags a missing exam name and missing or zero marks', () => {
    const draft = blankDraft('');
    draft.questions.push({ ...blankQuestion(), maxMarks: '0' });
    const issues = draftIssues(draft);
    expect(issues.map((i) => i.field)).toEqual([
      'exam-label',
      fieldId(draft.questions[0]!.key, 'marks'),
      fieldId(draft.questions[1]!.key, 'marks'),
    ]);
    expect(issues[2]?.message).toContain('Q2');
  });

  it('ignores editor keys and blank rows when checking for unsaved changes', () => {
    const a = draftFromForm(form);
    const b = draftFromForm(form);
    expect(sameDraft(a, b)).toBe(true);
    b.questions[0]!.commonMistakes.push('');
    expect(sameDraft(a, b)).toBe(true);
    b.questions[0]!.label = 'Changed';
    expect(sameDraft(a, b)).toBe(false);
  });

  it('labels the status from the saved form', () => {
    expect(examStatus(null)).toBe('unsaved');
    expect(examStatus(form)).toBe('ai-draft');
    expect(examStatus({ ...form, authoredBy: 'examiner' })).toBe('draft');
    expect(examStatus({ ...form, status: 'published' })).toBe('published');
  });

  it('moves items within bounds only', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

describe('student preview', () => {
  const catalogue = [
    mod('fluids-2', { 'fluid-mechanics': 0.9 }),
    mod('aero-3', { 'fluid-mechanics': 0.8 }),
    mod('cfd-4', { 'computational-simulation': 0.9 }, ['fluids-2']),
    mod('ethics', { 'policy-ethics': 0.9 }),
    mod('maths-minor', { 'mathematics-modelling': 0.3 }),
  ];

  it('builds a valid template feedback card for the question the student lost marks on', () => {
    const preview = previewFeedback({ draft: draftFromForm(form), weakIndex: 1, moduleId: 'fluids-2', catalogue });
    expect(preview).not.toBeNull();
    const { feedback, marks } = preview!;
    expect(schemas.TailoredFeedback.safeParse(feedback).success).toBe(true);
    expect(feedback.weakPoints).toHaveLength(1);
    expect(feedback.weakPoints[0]).toMatchObject({ questionId: 'Q2', lostMarks: 19.5 });
    expect(feedback.weakPoints[0]?.advice).toContain('most often: used laminar friction for turbulent flow; no units.');
    expect(feedback.revisionPlan[0]).toBe('Worked examples 4.2 to 4.5');
    expect(marks.find((m) => m.weak)?.questionId).toBe('Q2');
    expect(feedback.affectsModules.map((a) => a.moduleId)).toEqual(['cfd-4', 'aero-3']);
  });

  it('falls back to the first question with marks, and returns nothing without any', () => {
    const draft = draftFromForm(form);
    draft.questions[1]!.maxMarks = '';
    expect(previewFeedback({ draft, weakIndex: 1, moduleId: 'fluids-2', catalogue })?.weakIndex).toBe(0);
    draft.questions[0]!.maxMarks = '';
    expect(previewFeedback({ draft, weakIndex: 1, moduleId: 'fluids-2', catalogue })).toBeNull();
  });

  it('only counts main topics and never lists the module itself', () => {
    const affected = affectedModules('fluids-2', ['mathematics-modelling', 'fluid-mechanics'], catalogue);
    expect(affected.map((a) => a.moduleId)).not.toContain('fluids-2');
    expect(affected.map((a) => a.moduleId)).not.toContain('maths-minor');
  });

  it('writes synthetic example notes around the module topics', () => {
    const notes = exampleNotes(mod('fluids-2', { 'fluid-mechanics': 0.9, 'policy-ethics': 0.2 }));
    expect(notes).toMatch(/^Synthetic/);
    expect(notes).toContain('fluid mechanics');
    expect(exampleNotes(undefined)).toContain('Q3');
  });
});
