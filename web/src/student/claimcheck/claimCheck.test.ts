// Guards the claim check's rules: the thing to check follows what the content mentions, the public page is
// always a source, and the module lead is suggested only where a person can confirm the detail.
import { describe, expect, it } from 'vitest';
import { buildClaimCheck, explanationText, type ClaimKind } from './claimCheck.ts';

const URL = 'https://www.imperial.ac.uk/example-module/';
const plan = (kind: ClaimKind, text: string) => buildClaimCheck({ kind, text, sourceUrl: URL });

describe('buildClaimCheck', () => {
  it('picks the assessment weightings when the content mentions an exam or coursework', () => {
    expect(plan('answer', 'It is assessed by a written exam.').check.label).toBe('The assessment weightings');
    expect(plan('answer', 'Coursework is worth 30%.').check.label).toBe('The assessment weightings');
  });

  it('does not treat a workload percentage as an assessment weighting', () => {
    const text = 'From the module record: maths intensity 40%, coding 20%, workload 60%. Source: the public module page.';
    expect(plan('answer', text).check.label).toBe('The credits and workload');
  });

  it('picks the prerequisites when the content mentions what you need beforehand', () => {
    expect(plan('answer', 'You need to know linear algebra beforehand.').check.label).toBe('The prerequisites');
  });

  it('prefers assessment over prerequisites when both are mentioned', () => {
    expect(plan('summary', 'Requires calculus. Assessed by coursework.').check.label).toBe('The assessment weightings');
  });

  it('falls back to a kind-specific check when nothing specific is mentioned', () => {
    expect(plan('fit', 'You enjoy hands-on work.').check.label).toBe('The reason that matters most to you');
    expect(plan('answer', 'Yes.').check.label).toBe('The detail you would rely on');
  });

  it('does not match a topic word inside a longer word', () => {
    expect(plan('fit', 'You are interested in determined people.').check.label).toBe('The reason that matters most to you');
  });

  it('always offers the public module page as a link', () => {
    for (const kind of ['summary', 'summary-template', 'fit', 'answer'] as const) {
      const [first] = plan(kind, 'Anything.').sources;
      expect(first).toMatchObject({ label: 'Public module page', href: URL });
    }
  });

  it('suggests the module lead for answers and for details a person should confirm', () => {
    const lead = (kind: ClaimKind, text: string) => plan(kind, text).sources.some((s) => s.label === 'Ask the module lead');
    expect(lead('answer', 'Yes.')).toBe(true);
    expect(lead('summary', 'Assessed by exam.')).toBe(true);
    expect(lead('summary', 'Runs in the autumn term.')).toBe(false);
    expect(lead('fit', 'You enjoy hands-on work.')).toBe(false);
  });

  it('names the source of the fit tags', () => {
    const agent = buildClaimCheck({ kind: 'fit', text: '', sourceUrl: URL, derivedBy: 'analyst-agent' });
    const staff = buildClaimCheck({ kind: 'fit', text: '', sourceUrl: URL, derivedBy: 'staff-edit' });
    expect(agent.couldBeWrong).toMatch(/AI derived the tags/);
    expect(staff.couldBeWrong).toMatch(/Staff have reviewed/);
  });

  it('is deterministic', () => {
    expect(plan('answer', 'The exam is 70%.')).toEqual(plan('answer', 'The exam is 70%.'));
  });
});

describe('explanationText', () => {
  it('joins the summary, reasons and watch-outs', () => {
    const text = explanationText({
      moduleId: 'm',
      summary: 'A good fit.',
      because: [{ text: 'You like coding.' }],
      watchOuts: ['Heavy exam weighting.'],
    });
    expect(text).toBe('A good fit.\nYou like coding.\nHeavy exam weighting.');
  });
});
