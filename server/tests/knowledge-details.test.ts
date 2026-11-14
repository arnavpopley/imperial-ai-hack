// The published module details (docs/knowledge-base.md): every stored fact carries the public page it came from,
// the knowledge agent quotes them offline, and it declines when a page does not publish them.
import { describe, expect, it } from 'vitest';
import { answerByRules, moduleFacts } from '../src/agents/knowledge.ts';
import { rawModule } from '../src/db/catalogue.ts';
import { DATASET_FILES, ModulesFile, RawModulesFile, readDataset, type RawModule } from '../src/db/datasets.ts';

const raw = readDataset(DATASET_FILES.rawModules, RawModulesFile);
const modules = readDataset(DATASET_FILES.modules, ModulesFile).modules;
const module = (id: string) => modules.find((m) => m.id === id)!;
const facts = (id: string) => moduleFacts(module(id), rawModule(id), (p) => module(p)?.title ?? p);
const ask = (id: string, question: string) => answerByRules(question, facts(id));

/** Every sourceUrl inside a module's published details. */
function detailUrls(m: RawModule): string[] {
  const urls: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k === 'sourceUrl' && typeof v === 'string') urls.push(v);
        else visit(v);
      }
    }
  };
  const { sourceUrl: _own, ...rest } = m;
  visit(rest);
  return urls;
}

describe('published module details', () => {
  it('pair every fact with a public Imperial page', () => {
    for (const m of raw.modules) {
      for (const url of detailUrls(m)) expect(url, m.id).toMatch(/^https:\/\/(www|ib-programmes)\.imperial\.ac\.uk\//);
      if (m.learningOutcomesSourceUrl) expect(m.learningOutcomes.length, m.id).toBeGreaterThan(0);
    }
  });

  it('use the module page unless the fact comes from a linked outline', () => {
    for (const m of raw.modules) {
      for (const url of detailUrls(m)) {
        const outline = url.startsWith('https://ib-programmes.imperial.ac.uk/hubfs/Website-pdfs/BPES%20module%20outlines/');
        expect(url === m.sourceUrl || outline, `${m.id} ${url}`).toBe(true);
      }
    }
  });

  it('store names only for module leads, never contact details', () => {
    for (const m of raw.modules) {
      for (const name of m.moduleLeads?.names ?? []) expect(name, m.id).not.toMatch(/@|\d/);
    }
    // Lead names are published only on the I-Explore and Horizons pages.
    expect(raw.modules.filter((m) => m.moduleLeads).every((m) => m.type === 'i-explore')).toBe(true);
  });

  it('keep weighted assessment summing to 100% and pass marks as published', () => {
    for (const m of raw.modules.filter((x) => x.assessment.length)) {
      const total = m.assessment.reduce((s, a) => s + a.weighting, 0);
      // Pages round thirds (MECH70003 publishes 16.66% three times), so allow 0.1%.
      expect(Math.abs(total - 1), m.id).toBeLessThanOrEqual(0.001);
      for (const a of m.assessment) if (a.passMark) expect(a.passMark).toMatch(/^(\d+%|PF)$/);
    }
    const fea = rawModule('MECH60007')!;
    expect(fea.assessmentDetails?.passMark).toBe('40%');
    expect(fea.assessment.map((a) => a.passMark)).toEqual(['40%', '40%']);
  });

  it('only record independent-study hours that a statement states', () => {
    for (const m of raw.modules) {
      const h = m.hours?.independentStudyHours;
      if (h !== undefined) expect(m.hours!.statements.some((s) => s.includes(`${h} hours of independent study`)), m.id).toBe(true);
    }
  });

  it('restore the assessment and outcomes the first fetch missed', () => {
    expect(rawModule('BUSI60038')?.assessment.map((a) => [a.description, a.weighting])).toEqual([
      ['Group Report', 0.3],
      ['Written Examination', 0.7],
    ]);
    expect(rawModule('BUSI60038')?.learningOutcomesSourceUrl).toMatch(/Business%20Economics\.pdf$/);
    // data/modules.json is unchanged until the Module Analyst next runs, so the agents read the outcomes from the page.
    expect(facts('BUSI60038').learningOutcomes).toEqual(rawModule('BUSI60038')?.learningOutcomes);
    expect(rawModule('IEX-SPACE')?.assessment[1]?.description).toBe('Technical and Economic Interactive Poster Presentation submitted as a group');
  });
});

describe('knowledge agent on the published details (offline)', () => {
  it('names the published lecturer, and declines when no name is published', () => {
    expect(ask('IEX-ML', 'Who teaches this module?')).toContain('Josiah Wang');
    expect(ask('IEX-PSYCHPERF', 'Who is the lecturer?')).toContain("module's field leader");
    const none = ask('MECH60007', 'Who teaches it?');
    expect(none).toContain('does not name a lecturer or module leader');
    expect(none).not.toMatch(/\b(Dr|Professor)\b/);
  });

  it('quotes published hours, and declines when none are stated', () => {
    expect(ask('IEX-CLIMATE', 'How many hours of independent study is it?')).toContain('approximately 105 hours of independent study');
    expect(ask('MECH60003', 'How many hours a week does it take?')).toContain('500 hours per student');
    expect(ask('MECH60015', 'How many hours is it?')).toContain('does not state contact or study hours');
  });

  it('lists reading-list titles, and declines when the page has no list', () => {
    const list = rawModule('MECH60019')!.readingList!.items;
    const answer = ask('MECH60019', 'Is there a reading list?');
    expect(answer).toContain(`${list.length} entries`);
    expect(answer).toContain(list[0]!.title);
    expect(ask('MECH60007', 'What are the key textbooks?')).toContain('does not publish a reading list');
  });

  it('adds the published background to prerequisite answers', () => {
    const answer = ask('BUSI60038', 'What background do I need?');
    expect(answer).toContain('No previous knowledge of economics is required');
    expect(answer).toContain('Calculus in multiple variables');
  });

  it('quotes published deadlines and exam weeks, and declines when none are published', () => {
    expect(ask('BUSI60038', 'When is the exam?')).toContain('Wednesday 6 January 2027');
    expect(ask('IEX-HISTSCI', 'When are the deadlines?')).toContain('due at the start of spring term');
    expect(ask('MECH60007', 'Are there any deadlines?')).toContain('does not publish assessment deadlines');
  });

  it('passes weightings as published percentages, never as fractions', () => {
    expect(facts('MECH60004').publishedAssessment.map((a) => a.weighting)).toEqual(['100%']);
    expect(ask('MECH70003', 'How is it assessed?')).toContain('(16.66%, coursework)');
    expect(ask('MECH60007', 'How is it assessed?')).toContain('The published pass mark is 40%.');
  });

  it('describes teaching from the page', () => {
    expect(ask('MECH60007', 'How is it taught?')).toContain('5x3hr lectures');
  });

  it('gives the model every published field, null when unpublished, and caps the reading list', () => {
    const f = facts('MECH70014');
    expect(f.readingList?.totalItems).toBe(rawModule('MECH70014')!.readingList!.items.length);
    expect(f.readingList!.items.length).toBeLessThanOrEqual(15);
    expect(f.moduleLeads).toBeNull();
    expect(facts('IEX-ML').moduleLeads?.names).toEqual(['Josiah Wang']);
    expect(facts('IEX-ML').hours?.independentStudyHours).toBe(105);
  });
});
