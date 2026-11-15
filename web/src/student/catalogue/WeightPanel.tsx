// What-if sliders (spec 3, item 9): change the four weights and nothing else. The list re-ranks
// on every move; the server copy is saved after a short pause.
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RangeSlider } from '../../components/RangeSlider.tsx';
import { Spinner } from '../../components/Spinner.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { paths } from '../routes.ts';
import { useCatalogue, type SaveState, type WeightKey } from '../state/CatalogueProvider.tsx';
import { levelWord, weightShares } from './weightShares.ts';

/** Each weight's colour, shared by its slider and its segment of the mix bar. */
const SLIDERS: readonly { key: WeightKey; label: string; short: string; fill: string; border: string }[] = [
  { key: 'interest', label: 'Interest', short: 'Interest', fill: 'bg-module-1', border: 'border-module-1' },
  { key: 'goal', label: 'Career', short: 'Career', fill: 'bg-module-2', border: 'border-module-2' },
  { key: 'style', label: 'Learning style', short: 'Style', fill: 'bg-module-4', border: 'border-module-4' },
  { key: 'breadth', label: 'Breadth', short: 'Breadth', fill: 'bg-module-3', border: 'border-module-3' },
];

/** The fit score's mix as one stacked bar, with each weight's share beneath it. */
function MixBar({ shares }: { shares: Record<WeightKey, number> }) {
  const parts = SLIDERS.filter(({ key }) => shares[key] > 0);
  return (
    <div className="mt-2 grid gap-1.5">
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {parts.map(({ key, fill }) => (
          <motion.span key={key} className={`h-full ${fill}`} initial={false} animate={{ width: `${shares[key]}%` }} transition={{ duration: 0.25 }} />
        ))}
      </div>
      <ul aria-label="Share of your fit score" className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-2xs text-muted">
        {SLIDERS.map(({ key, label, short, fill }) => (
          <li key={key} className="flex items-center gap-1">
            <span aria-hidden="true" className={`size-2 rounded-full ${fill}`} />
            <span aria-hidden="true">{short}</span>
            <span className="sr-only">{label}</span>
            <span className="font-semibold text-ink tabular-nums">{shares[key]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const saveCopy: Record<Exclude<SaveState, 'idle'>, string> = {
  saving: 'Saving',
  saved: 'Saved',
  error: 'Not saved. Move a slider to retry.',
};

export function WeightPanel({ goalUsed }: { goalUsed: boolean }) {
  const { weights, setWeight, resetWeights, isDefaultWeights, saveState } = useCatalogue();
  const enter = useMotionTokens().softEnter('answerFeedback', 2);
  const shares = weightShares(weights, goalUsed);
  return (
    <section aria-labelledby="weights-heading" className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="weights-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="sliders" size={15} className="text-brand" />
          What matters most?
        </h2>
        <Button variant="ghost" size="sm" icon="reset" onClick={resetWeights} disabled={isDefaultWeights} className="-mr-2">
          Reset
        </Button>
      </div>
      <p className="text-2xs text-muted">How much each matters, and its share of your fit:</p>
      <MixBar shares={shares} />
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-1">
        {SLIDERS.map(({ key, label, fill, border }) => {
          const disabled = key === 'goal' && !goalUsed;
          return (
            <RangeSlider
              key={key}
              label={label}
              value={weights[key]}
              disabled={disabled}
              accent={{ fill, border }}
              valueText={disabled ? 'n/a' : levelWord(weights[key])}
              ariaValueText={disabled ? 'Not used: no pathway chosen' : `${levelWord(weights[key])}, ${shares[key]}% of your fit score`}
              onChange={(value) => setWeight(key, value)}
            />
          );
        })}
      </div>
      {!goalUsed && (
        <p className="mt-3 text-2xs text-muted">
          Career needs a pathway.{' '}
          <Link to={paths.pathways} className="font-medium text-brand underline-offset-2 hover:underline">
            Choose one
          </Link>
        </p>
      )}
      <p className="mt-3 flex h-4 items-center text-2xs text-muted" aria-live="polite">
        {saveState !== 'idle' && (
          // Each state fades in softly on the feedback clock; a failed save is calm, never a flash.
          <motion.span key={saveState} {...enter} className="flex items-center gap-1.5">
            {saveState === 'saving' && <Spinner size={11} />}
            {saveState === 'saved' && <Icon name="check" size={11} className="text-fit-high" />}
            {saveCopy[saveState]}
          </motion.span>
        )}
      </p>
    </section>
  );
}
