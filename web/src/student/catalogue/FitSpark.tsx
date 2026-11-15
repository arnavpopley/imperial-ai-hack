// The spread of the student's fit scores as a tiny histogram, in the same style as the staff module list's spark:
// ten 10-point bands, good fits and above tinted. Decorative beside the figures it summarises.
import { FIT_BAND_FLOORS } from '@modulematch/shared';

/** Counts of fits in ten 10-point bands, 0-9 to 90-100. */
export function fitBands(fits: readonly number[]): number[] {
  const bands = Array<number>(10).fill(0);
  for (const fit of fits) bands[Math.min(9, Math.max(0, Math.floor(fit / 10)))]! += 1;
  return bands;
}

/** `muted` greys every band, for scores that are only rough while the profile is incomplete. */
export function FitSpark({ fits, muted = false }: { fits: readonly number[]; muted?: boolean }) {
  const bands = fitBands(fits);
  const max = Math.max(1, ...bands);
  return (
    <span aria-hidden="true" title="Fit spread, 0 to 100" className="flex h-7 w-20 shrink-0 items-end gap-px">
      {bands.map((count, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-[2px] ${!muted && i * 10 >= FIT_BAND_FLOORS.good ? 'bg-fit-high' : 'bg-line-strong'}`}
          style={{ height: `${count > 0 ? Math.max(14, (count / max) * 100) : 6}%` }}
        />
      ))}
    </span>
  );
}
