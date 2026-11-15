import { describe, expect, it } from 'vitest';
import { firstModule } from '../components/ModulePicker.tsx';
import { groupRows, hasOffers, inView, shortlistFigure, shortlistLabel, strongFitShare } from './moduleList.ts';
import type { StaffModuleSummary } from '@modulematch/shared';

const row = (moduleId: string, patch: Partial<StaffModuleSummary> = {}): StaffModuleSummary => ({
  moduleId,
  code: moduleId,
  title: `Module ${moduleId}`,
  type: 'elective',
  capacity: 60,
  shortlisted: 20,
  averageFit: 40,
  fitHistogram: [0, 0, 10, 10, 10, 10, 5, 3, 2, 0],
  cohortSize: 50,
  offer: 'elective',
  ...patch,
});

describe('staff module list', () => {
  it('measures the share of the cohort with a strong fit from the histogram', () => {
    expect(strongFitShare(row('A'))).toBeCloseTo(10 / 50);
    expect(strongFitShare(row('B', { fitHistogram: Array(10).fill(0) }))).toBe(0);
  });

  it('labels demand honestly: compulsory, not offered, none yet, and counts under five as a band', () => {
    expect(shortlistLabel(row('A', { offer: 'core', shortlisted: 0 }))).toBe('Compulsory for this cohort');
    expect(shortlistLabel(row('A', { offer: 'not-offered', shortlisted: 0 }))).toBe('Not offered to this cohort');
    expect(shortlistLabel(row('A', { shortlisted: 0 }))).toBe('No shortlists yet');
    expect(shortlistLabel(row('A', { shortlisted: 3 }))).toBe('Under 5 shortlisted');
    expect(shortlistLabel(row('A', { shortlisted: 12 }))).toBe('12 / 60 shortlisted');
    expect(shortlistLabel(row('A', { shortlisted: 12, capacity: null }))).toBe('12 shortlisted');
    expect(shortlistFigure(row('A', { shortlisted: 4 }))).toBe(0);
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
      row('N', { offer: 'not-offered', fitHistogram: [0, 0, 0, 0, 0, 0, 0, 0, 50, 0] }),
      row('E1', { fitHistogram: [0, 0, 40, 0, 0, 0, 0, 10, 0, 0] }),
      row('E2', { fitHistogram: [0, 0, 30, 0, 0, 0, 0, 20, 0, 0] }),
    ];
    expect(firstModule(rows)?.moduleId).toBe('E2');
  });
});
