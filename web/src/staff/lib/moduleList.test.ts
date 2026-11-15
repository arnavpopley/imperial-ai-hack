import { describe, expect, it } from 'vitest';
import { firstModule } from '../components/ModulePicker.tsx';
import { groupRows, hasOffers, inView, shortlistFigure, shortlistLabel, strongFitShare, strongFitText } from './moduleList.ts';
import type { StaffModuleSummary } from '@modulematch/shared';

const row = (moduleId: string, patch: Partial<StaffModuleSummary> = {}): StaffModuleSummary => ({
  moduleId,
  code: moduleId,
  title: `Module ${moduleId}`,
  type: 'elective',
  capacity: 60,
  shortlisted: 20,
  averageFit: 40,
  fitBands: [
    { from: 0, to: 19, students: 0 },
    { from: 20, to: 59, students: 40 },
    { from: 60, to: 100, students: 10 },
  ],
  strongFitShare: 10 / 50,
  cohortSize: 50,
  offer: 'elective',
  ...patch,
});

describe('staff module list', () => {
  it('takes the strong-fit share from the server, since withheld bands cannot be summed', () => {
    expect(strongFitShare(row('A'))).toBeCloseTo(10 / 50);
    // Withheld (one to four students on either side of the line): unknown, so it sorts after every known share,
    // even a share of zero, and reads as a neutral mark rather than a small number.
    const withheldRow = row('B', { strongFitShare: null });
    expect(strongFitShare(withheldRow)).toBeLessThan(strongFitShare(row('C', { strongFitShare: 0 })));
    expect(strongFitText(withheldRow, (f) => `${Math.round(f * 100)}%`)).toBe('—');
    expect(strongFitText(row('A'), (f) => `${Math.round(f * 100)}%`)).toBe('20%');
  });

  it('labels demand honestly: compulsory, not offered, none yet, and counts under five as a band', () => {
    expect(shortlistLabel(row('A', { offer: 'core', shortlisted: 0 }))).toBe('Compulsory for this cohort');
    expect(shortlistLabel(row('A', { offer: 'not-offered', shortlisted: 0 }))).toBe('Not offered to this cohort');
    expect(shortlistLabel(row('A', { shortlisted: 0 }))).toBe('No shortlists yet');
    expect(shortlistLabel(row('A', { shortlisted: 3 }))).toBe('Under 5 shortlisted');
    expect(shortlistLabel(row('A', { shortlisted: 12 }))).toBe('12 / 60 shortlisted');
    expect(shortlistLabel(row('A', { shortlisted: 12, capacity: null }))).toBe('12 shortlisted');
    expect(shortlistFigure(row('A', { shortlisted: 4 }))).toBe(0);
    // The server sends null for one to four students (spec 20.4).
    expect(shortlistLabel(row('A', { shortlisted: null }))).toBe('Under 5 shortlisted');
    expect(shortlistFigure(row('A', { shortlisted: null }))).toBe(0);
  });

  it('shows options by default and groups every view by offer', () => {
    const rows = [
      row('E'),
      row('X', { offer: 'i-explore', type: 'i-explore' }),
      row('C', { offer: 'core', type: 'core' }),
      row('N', { offer: 'not-offered' }),
    ];
    expect(rows.filter((r) => inView(r, 'options')).map((r) => r.moduleId)).toEqual(['E', 'X']);
    expect(rows.filter((r) => inView(r, 'core')).map((r) => r.moduleId)).toEqual(['C']);
    expect(groupRows(rows).map((g) => [g.label, g.rows.length])).toEqual([
      ['Electives', 1],
      ['I-Explore', 1],
      ['Compulsory', 1],
      ['Not offered to this cohort', 1],
    ]);
  });

  it('falls back to one ungrouped list when the server sends no offers', () => {
    const rows = [row('A', { offer: undefined }), row('B', { offer: undefined })];
    expect(hasOffers(rows)).toBe(false);
    expect(rows.every((r) => inView(r, 'options'))).toBe(true);
    expect(groupRows(rows)).toEqual([{ offer: null, label: 'Modules', rows }]);
  });

  it('opens on the strongest-fit option, never a module the cohort cannot take', () => {
    const rows = [
      row('N', { offer: 'not-offered', strongFitShare: 1 }),
      row('E1', { strongFitShare: 0.2 }),
      row('E2', { strongFitShare: 0.4 }),
    ];
    expect(firstModule(rows)?.moduleId).toBe('E2');
  });
});
