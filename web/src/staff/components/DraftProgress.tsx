// Progress for the AI drafting a form from marking notes. The steps advance on a timer, since the request
// reports no progress of its own; the last step stays active until the draft arrives.
import { useEffect, useState } from 'react';
import { CheckIcon } from './icons.tsx';

const STEPS = [
  'Reading your marking notes',
  'Splitting them into questions and marks',
  'Matching each question to taxonomy topics',
  'Writing mistakes and revision pointers',
] as const;

const STEP_MS = 1400;

export function DraftProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  return (
    <div role="status" aria-live="polite" className="grid gap-4 rounded-2xl bg-surface-2/70 p-5 ring-1 ring-line">
      <p className="text-sm font-semibold">Drafting your form…</p>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
          style={{ width: `${((step + 1) / (STEPS.length + 1)) * 100}%` }}
        />
      </div>
      <ol className="grid gap-2.5">
        {STEPS.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li
              key={label}
              className={`flex items-center gap-3 text-sm ${state === 'todo' ? 'text-muted' : 'text-ink'}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center rounded-full ${
                  state === 'done'
                    ? 'bg-fit-high text-surface'
                    : state === 'active'
                      ? 'bg-brand-soft text-brand ring-2 ring-brand/40'
                      : 'bg-surface ring-1 ring-line-strong'
                }`}
              >
                {state === 'done' ? (
                  <CheckIcon className="size-3.5" />
                ) : state === 'active' ? (
                  <span className="size-2 animate-pulse-dot rounded-full bg-brand" />
                ) : null}
              </span>
              {label}
              <span className="sr-only">{state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
