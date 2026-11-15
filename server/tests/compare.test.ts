// Issue 62: the catalogue's compare view, from the module records and the timetable engine.
import { schemas } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { assessmentSplit } from '../src/agents/compare.ts';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

describe('assessmentSplit', () => {
  it('uses the published weighted components, as whole percentages adding up to 100', () => {
    const split = assessmentSplit(
      [
        { type: 'examination', weighting: 0.6 },
        { type: 'coursework', weighting: 0.25 },
        { type: 'practical', weighting: 0.15 },
      ],
      0.9,
    );
    expect(split).toEqual({ exam: 60, coursework: 25, practical: 15, source: 'published' });
  });

  it('scales published weightings that do not add up to one', () => {
    expect(assessmentSplit([{ type: 'examination', weighting: 0.3 }, { type: 'coursework', weighting: 0.3 }], 0)).toEqual({
      exam: 50,
      coursework: 50,
      practical: 0,
      source: 'published',
    });
  });

  it('estimates from the exam share when the page publishes no weighted components', () => {
    expect(assessmentSplit([], 0.7)).toEqual({ exam: 70, coursework: 30, practical: 0, source: 'estimated' });
  });
});

describe('GET /sessions/:id/compare', () => {
  let s = '';
  beforeAll(async () => {
    seedIfEmpty();
    const res = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    s = `/api/sessions/${schemas.SessionState.parse(await res.json()).id}`;
  });

  const compare = async (ids: string) => app.request(`${s}/compare?ids=${encodeURIComponent(ids)}`);

  it('returns record facts for each module, in the order asked', async () => {
    const view = schemas.CompareView.parse(await (await compare('MECH60006,MECH60009')).json());
    expect(view.modules.map((m) => m.moduleId)).toEqual(['MECH60006', 'MECH60009']);
    for (const m of view.modules) {
      const { exam, coursework, practical } = m.assessment;
      expect(exam + coursework + practical).toBe(100);
      expect(m.slots.every((slot) => slot.moduleId === m.moduleId)).toBe(true);
    }
  });

  it('shows clashes with the student shortlist', async () => {
    // MECH60018 and MECH60009 both meet on Tuesday at 14:00 in spring (the demo clash).
    expect((await app.request(`${s}/shortlist`, json({ moduleId: 'MECH60018', action: 'add' }))).ok).toBe(true);
    const view = schemas.CompareView.parse(await (await compare('MECH60009,MECH60006')).json());
    const embedded = view.modules.find((m) => m.moduleId === 'MECH60009');
    expect(embedded?.clashes).toContainEqual(expect.objectContaining({ withModuleId: 'MECH60018', label: 'certain', core: false }));
  });

  it('accepts module codes, and refuses one module, four modules or the same module twice', async () => {
    expect((await compare('MECH60006,MECH60009')).status).toBe(200);
    expect((await compare('MECH60006')).status).toBe(400);
    expect((await compare('MECH60006,MECH60009,MECH60018,MECH60017')).status).toBe(400);
    expect((await compare('MECH60006,mech60006')).status).toBe(404);
    expect((await compare('MECH60006,NOPE')).status).toBe(404);
  });
});
