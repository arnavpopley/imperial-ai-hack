// Guards the catalogue search: title, code and topic matches, forgiving typos, and no false hits.
import { describe, expect, it } from 'vitest';
import { matchesQuery, normalise } from './search.ts';

const fluids = { title: 'Fluid Mechanics 3A', code: 'MECH60006', topics: ['Fluid mechanics', 'Mathematics and modelling'] };
const finance = { title: 'Finance & Financial Management', code: 'BUSI60043', topics: ['Finance and economics'] };

describe('normalise', () => {
  it('lower-cases, drops accents and punctuation, and reads & as and', () => {
    expect(normalise('  Café & Co-op! ')).toBe('cafe and co op');
  });
});

describe('matchesQuery', () => {
  it('matches every module on an empty query', () => {
    expect(matchesQuery(fluids, '   ')).toBe(true);
  });

  it('matches the title, in any case and word order', () => {
    expect(matchesQuery(fluids, 'fluid mechanics 3a')).toBe(true);
    expect(matchesQuery(fluids, '3A Fluid')).toBe(true);
    expect(matchesQuery(finance, 'finance and financial')).toBe(true);
  });

  it('matches the code, whole or in part', () => {
    expect(matchesQuery(fluids, 'MECH60006')).toBe(true);
    expect(matchesQuery(fluids, 'mech 6')).toBe(true);
    expect(matchesQuery(finance, 'busi')).toBe(true);
  });

  it('matches topic labels', () => {
    expect(matchesQuery(fluids, 'modelling')).toBe(true);
    expect(matchesQuery(finance, 'economics')).toBe(true);
  });

  it('forgives typos in longer words, including a mistyped code', () => {
    expect(matchesQuery(fluids, 'fluid mechancs')).toBe(true);
    expect(matchesQuery(fluids, 'mathmatics')).toBe(true);
    expect(matchesQuery(fluids, 'mech6006')).toBe(true);
    expect(matchesQuery(finance, 'finan')).toBe(true);
  });

  it('needs every word to match, and does not match unrelated words', () => {
    expect(matchesQuery(fluids, 'fluid finance')).toBe(false);
    expect(matchesQuery(fluids, 'robotics')).toBe(false);
    expect(matchesQuery(fluids, 'xyz')).toBe(false);
    expect(matchesQuery(finance, 'fluid')).toBe(false);
  });
});
