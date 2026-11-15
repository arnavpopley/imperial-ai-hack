// Issue #106: the sentence splitter keeps abbreviations, initials, decimals and brackets inside a sentence, so
// every module's offline summary ends cleanly. Issue #113: module Q&A never pastes a raw URL, answers a yes/no
// exam question directly, and gives guarantee questions the same no-promise reply as the advisor chat.
import { schemas as S } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { answerByRules, moduleFacts, SUMMARY_CAP, summaryByTemplate, withoutUrls } from '../src/agents/knowledge.ts';
import { NO_GUARANTEE } from '../src/agents/outcomes.ts';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';
import { rawModule } from '../src/db/catalogue.ts';
import { DATASET_FILES, ModulesFile, readDataset } from '../src/db/datasets.ts';
import * as repo from '../src/db/repo.ts';
import { sentences } from '../src/guardrails/types.ts';

const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
const titleOf = (id: string) => modules.find((m) => m.id === id)?.title ?? id;
const facts = (id: string) => moduleFacts(modules.find((m) => m.id === id)!, rawModule(id), titleOf);

describe('sentences', () => {
  it('does not split on abbreviations, initials, decimals or inside brackets', () => {
    const cases: [string, number][] = [
      ['It is a foundation for learning others (e.g. C++ and Python). It runs in spring.', 2],
      ['Use one language, i.e. C. Then test it.', 2],
      ['Topics include sensors, actuators, etc. and control.', 1],
      ['Roughly approx. 3.5 hours a week. Labs are extra.', 2],
      ['Taught by Dr. Smith and Prof. A. Jones. Labs on Fridays.', 2],
      ['The lecturer is J. R. Smith. Ask her.', 2],
      ['Labs are written in C. Then they are tested.', 2],
      ['Machine Dynamics and Vibrations A. This module covers rotors.', 2],
      ['It covers rigs (see Fig. 2. for details) and tests. Done.', 2],
    ];
    for (const [text, count] of cases) expect(sentences(text), text).toHaveLength(count);
  });

  it('ends a sentence at "etc." when a new sentence starts, and at a line break', () => {
    expect(sentences('Pumps, fans, etc. The labs use them.')).toHaveLength(2);
    expect(sentences('First line\nSecond line.')).toEqual(['First line\n', 'Second line.']);
  });

  it('gives the text back when the pieces are joined', () => {
    for (const m of modules) expect(sentences(m.description).join('')).toBe(m.description);
  });
});

describe('offline module summaries', () => {
  it('end cleanly, keep brackets balanced and stay within the cap for every seeded module', () => {
    for (const m of modules) {
      const { summary } = summaryByTemplate(m);
      expect(summary, m.id).toMatch(/[.!?…]["'’”)\]]*$/);
      expect((summary.match(/[([]/g) ?? []).length, m.id).toBe((summary.match(/[)\]]/g) ?? []).length);
      expect(summary.length, m.id).toBeLessThanOrEqual(SUMMARY_CAP + 1);
    }
  });

  it('no longer cuts the demo modules at "e.g."', () => {
    for (const id of ['MECH60009', 'MECH40004']) expect(summaryByTemplate(modules.find((m) => m.id === id)!).summary).not.toMatch(/e\.g\.$/);
  });
});

describe('module Q&A answers', () => {
  it('answers "is there an exam" with a direct first word', () => {
    expect(answerByRules('Is there an exam, and who teaches it?', facts('MECH60009'))).toMatch(/^No written exam: it is assessed by Project \(80%, coursework\), Labs \(20%, practical\)\./);
  });

  it('never pastes a raw URL, offline or live', () => {
    for (const q of ['Who teaches it?', 'What are the office hours?', 'Is there a reading list?', 'What colour is the logo?']) {
      expect(answerByRules(q, facts('MECH60009')), q).not.toMatch(/https?:\/\//);
    }
    expect(withoutUrls('The full page is at https://www.imperial.ac.uk/x/?module=MECH60009&year=26_27. Ask the lead.')).toBe(
      'The full page is at the public module page. Ask the lead.',
    );
  });
});

describe('module Q&A route', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  async function ask(question: string) {
    const created = await createApp().request('/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }) });
    const { id } = S.SessionState.parse(await created.json());
    const res = await createApp().request(`/api/sessions/${id}/modules/MECH60009/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
    const text = (await res.text())
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => S.SseEvent.parse(JSON.parse(l.slice(6))))
      .flatMap((e) => (e.type === 'token' ? [e.text] : []))
      .join('');
    return { id, text };
  }

  it('gives a guarantee question the advisor no-promise reply, traced as G8', async () => {
    const { id, text } = await ask('Will this module guarantee me a job at Tesla?');
    expect(text.startsWith(NO_GUARANTEE)).toBe(true);
    expect(text).toMatch(/\d+%/);
    expect(repo.listTraceEvents(id).some((e) => e.actor === 'G8 claims' && e.verdict === 'block')).toBe(true);
  });

  it('redirects an out-of-scope request instead of answering it', async () => {
    const { text } = await ask('Can you write my cover letter for Ocado?');
    expect(text).toContain('Careers Service');
  });
});
