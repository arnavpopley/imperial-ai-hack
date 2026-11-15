// Issue #105: the web's rings, chips and labels use the shared bands, and a good match never wears a warning colour.
import { FIT_BAND_FLOORS } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { FIT_BAND_LABELS, FIT_BAND_METER, FIT_BAND_TEXT, fitBand } from './FitScore.tsx';

describe('fit bands on the web', () => {
  it('label the demo profile’s best match (62) as a good fit, in green', () => {
    expect(FIT_BAND_LABELS[fitBand(62)]).toBe('Good fit');
    expect(FIT_BAND_TEXT[fitBand(62)]).not.toMatch(/fit-mid|fit-low/);
    expect(FIT_BAND_METER[fitBand(62)]).toBe('high');
  });

  it('keep amber and red for partial and weak fits only', () => {
    expect(FIT_BAND_TEXT[fitBand(FIT_BAND_FLOORS.partial)]).toBe('text-fit-mid');
    expect(FIT_BAND_TEXT[fitBand(FIT_BAND_FLOORS.partial - 1)]).toBe('text-fit-low');
    expect(FIT_BAND_TEXT[fitBand(FIT_BAND_FLOORS.strong)]).toBe('text-fit-high');
  });
});
