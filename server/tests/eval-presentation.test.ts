// Issue #115: the evaluation on "How it works" is audience-ready. Misses have a human title and a one-line reason
// with the judge's words kept in full, the offline results never depend on a CLI step, and the page can tell
// whether the agents ran on the models or on their templates.
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { evalSnapshot, seedIfEmpty } from '../src/bootstrap.ts';
import { latestLiveEval, missReason, missTitle } from '../src/routes/live-results.ts';

const titleOf = (id: string) => ({ MECH60002: 'Fracture Mechanics A', MECH60016: 'Mathematics A' })[id] ?? id;

describe('a miss, as the audience sees it', () => {
  beforeAll(() => {
    seedIfEmpty();
  });

  it('has a title with module names and words, not ids and slot keys', () => {
    expect(missTitle('MECH60002 assessment', titleOf)).toBe('Fracture Mechanics A: how it is assessed');
    expect(missTitle('structural analyst: MECH60016', titleOf)).toBe('Structural analyst: Mathematics A');
    expect(missTitle('motorsport aerodynamicist: interest:fluid-mechanics', titleOf)).toBe('Motorsport aerodynamicist: interest in fluid mechanics');
    expect(missTitle('robotics builder: style.examPreference', titleOf)).toBe('Robotics builder: exam preference');
  });

  it('has a one-line reason that is never cut mid-word', () => {
    expect(missReason('missing 3 Hour exam 100%: Fracture Mechanics A is assessed entirely by examination.')).toBe(
      'The answer left out "3 Hour exam 100%", which the published record states.',
    );
    const judged =
      "The answer invents unsupported claims: 'no coursework' and 'no continuous assessment' are not in the data (examShare=1 could mean weighting, and applied=0.1 suggests some non-exam element), and more.";
    expect(missReason(judged)).toBe("The answer invents unsupported claims: 'no coursework' and 'no continuous assessment' are not in the data.");
    const rambling = `${'word '.repeat(60)}end.`;
    expect(missReason(rambling).length).toBeLessThanOrEqual(161);
    expect(missReason(rambling).endsWith('word…')).toBe(true);
    expect(missReason('Short and clear.')).toBe('Short and clear.');
  });

  it('is served with its title and reason, and the judge note unchanged', async () => {
    const raw = latestLiveEval()!;
    const served = (await (await createApp().request('/api/eval/live')).json()) as {
      results: { details: { pass: boolean; note?: string; title?: string; reason?: string }[] }[];
    };
    expect(served.results.length).toBe(raw.results.length);
    let misses = 0;
    for (const [i, r] of served.results.entries()) {
      for (const [j, d] of r.details.entries()) {
        expect(d.note).toBe(raw.results[i]!.details[j]!.note);
        if (!d.pass) {
          misses += 1;
          expect(d.title).toBeTruthy();
          expect(d.reason).toBeTruthy();
          expect(d.title).not.toMatch(/\b[A-Z]{3,5}\d{5}\b/);
        }
      }
    }
    expect(misses).toBeGreaterThan(0);
  });
});

describe('the offline results', () => {
  it('fall back to the committed snapshot, so the page never asks for a command', () => {
    expect(evalSnapshot()?.results.length).toBeGreaterThan(0);
  });

  it('health says the models are off in offline mode', async () => {
    expect(await (await createApp().request('/api/health')).json()).toEqual({ ok: true, live: false });
  });
});
