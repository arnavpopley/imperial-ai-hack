// Insight cards stay the same across staff decisions and reloads: a decision never feeds back into the cards,
// the main gap does not depend on the order the cohort is read in, and a live rewording is reused for the same
// engine card instead of being asked for again on every load.
import { DEFAULT_WEIGHTS, schemas, type Insight } from '@modulematch/shared';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/agents/llm.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/agents/llm.ts')>()),
  isLive: vi.fn(() => false),
  structured: vi.fn(),
}));

const llm = await import('../src/agents/llm.ts');
const { clearInsightWording, wordInsight } = await import('../src/agents/insights.ts');
const { createApp } = await import('../src/app.ts');
const { seedIfEmpty } = await import('../src/bootstrap.ts');
const { rulesFor } = await import('../src/db/catalogue.ts');
const repo = await import('../src/db/repo.ts');
const { buildInsights } = await import('../src/engines/index.ts');

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const cardsFor = async (moduleId: string) =>
  schemas.Insight.array().parse(await (await app.request(`/api/staff/modules/${moduleId}/insights`)).json());

beforeAll(() => {
  seedIfEmpty();
});

describe('a staff decision leaves the cards alone', () => {
  it('accepting a card keeps every card headline and detail, on every module', async () => {
    const modules = schemas.StaffModuleSummary.array().parse(await (await app.request('/api/staff/modules')).json());
    let decided = 0;
    for (const { moduleId } of modules) {
      const before = await cardsFor(moduleId);
      const [first] = before;
      if (!first) continue;
      const res = await app.request(`/api/staff/insights/${encodeURIComponent(first.id)}/decision`, json({ decision: 'accepted' }));
      expect(res.ok).toBe(true);
      decided += 1;
      const after = await cardsFor(moduleId);
      const words = (cards: Insight[]) => cards.map(({ id, headline, detail }) => ({ id, headline, detail }));
      expect(words(after)).toEqual(words(before));
      expect(after.find((c) => c.id === first.id)?.decision).toBe('accepted');
    }
    expect(decided).toBeGreaterThan(10);
    // Two full insight builds per module across the catalogue: slower than vitest's 5s default on a CI runner.
  }, 60_000);
});

describe('the main gap does not depend on cohort order', () => {
  it('reading the cohort in reverse gives the same cards for every module', () => {
    const rows = repo.listCohort();
    const first = rows[0]!.profile;
    const rules = rulesFor(first.programme, first.yearOfStudy)!;
    const context = (list: typeof rows) => ({
      modules: repo.listModules(),
      cohort: list.map((s) => s.profile),
      shortlists: list.map((s) => s.shortlist),
      weights: DEFAULT_WEIGHTS,
      homeTopics: rules.homeTopics,
      slots: repo.listSlots(),
      rules,
    });
    const forward = context(rows);
    const backward = context([...rows].reverse());
    for (const module of forward.modules) {
      const headlines = (ctx: typeof forward) =>
        buildInsights(module, ctx)
          .filter((card) => card.kind !== 'CLASH')
          .map((card) => card.headline);
      expect(headlines(backward), module.id).toEqual(headlines(forward));
    }
  }, 60_000);
});

describe('live wording is reused for the same engine card', () => {
  const card: Insight = {
    id: 'M:COUNTERFACTUAL:summary',
    moduleId: 'M',
    kind: 'COUNTERFACTUAL',
    headline: 'No single change makes a big difference; the main gap is the exam-heavy assessment',
    detail: '24 students are interested in the topics of M, but its fit for them is below 75.',
    cohortSize: 24,
    upliftPoints: null,
    decision: 'pending',
  };

  // A model that words the card differently every time it is asked, keeping the card's numbers (24 and 75), so
  // every rewrite passes the number and plain-wording checks and is the one that is shown.
  const rewrites = [
    { headline: 'No one change helps much; assessment is the main gap', detail: '24 interested students rate it below fit 75.' },
    { headline: 'Small changes will not move it; look at the exams', detail: 'Fit stays under 75 for 24 interested students.' },
    { headline: 'Nothing tested lifts it far; exams weigh most', detail: '24 keen students sit below fit 75.' },
  ];
  const varyingModel = () => {
    let call = 0;
    vi.mocked(llm.structured).mockReset();
    vi.mocked(llm.structured).mockImplementation(async () => rewrites[call++ % rewrites.length] as never);
  };

  it('asks the model once, then gives the same accepted words on every load until the engine card changes', async () => {
    vi.mocked(llm.isLive).mockReturnValue(true);
    varyingModel();
    clearInsightWording();
    const first = await wordInsight(card);
    expect({ headline: first.headline, detail: first.detail }).toEqual(rewrites[0]);
    const again = await wordInsight({ ...card, decision: 'accepted' });
    expect({ headline: again.headline, detail: again.detail }).toEqual(rewrites[0]);
    expect(again.decision).toBe('accepted');
    expect(vi.mocked(llm.structured)).toHaveBeenCalledTimes(1);
    // New engine content (for example after a tag edit) is worded afresh.
    await wordInsight({ ...card, detail: '30 students are interested in the topics of M, but its fit for them is below 75.' });
    expect(vi.mocked(llm.structured)).toHaveBeenCalledTimes(2);
    vi.mocked(llm.isLive).mockReturnValue(false);
  });

  it('gives overlapping loads of the same card one model call and the same words', async () => {
    vi.mocked(llm.isLive).mockReturnValue(true);
    varyingModel();
    clearInsightWording();
    const [a, b] = await Promise.all([wordInsight(card), wordInsight(card)]);
    expect(vi.mocked(llm.structured)).toHaveBeenCalledTimes(1);
    expect(b.headline).toBe(a.headline);
    expect(b.detail).toBe(a.detail);
    vi.mocked(llm.isLive).mockReturnValue(false);
  });

  it('does not keep a failed call, so the next load tries again', async () => {
    vi.mocked(llm.isLive).mockReturnValue(true);
    vi.mocked(llm.structured).mockReset();
    vi.mocked(llm.structured).mockRejectedValueOnce(new Error('network'));
    clearInsightWording();
    expect((await wordInsight(card)).headline).toBe(card.headline);
    vi.mocked(llm.structured).mockResolvedValueOnce({ headline: 'Reworded: no single change helps', detail: '24 students; fit below 75.' } as never);
    expect((await wordInsight(card)).headline).toBe('Reworded: no single change helps');
    vi.mocked(llm.isLive).mockReturnValue(false);
  });
});
