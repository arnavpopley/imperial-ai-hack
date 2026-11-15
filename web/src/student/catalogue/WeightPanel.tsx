// What-if sliders (spec 3, item 9): change the four weights and nothing else. The list re-ranks
// on every move; the server copy is saved after a short pause.
import type { Weights } from '@modulematch/shared';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RangeSlider } from '../../components/RangeSlider.tsx';
import { Spinner } from '../../components/Spinner.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { paths } from '../routes.ts';
import { useCatalogue, type SaveState, type WeightKey } from '../state/CatalogueProvider.tsx';

const SLIDERS: readonly { key: WeightKey; label: string }[] = [
  { key: 'interest', label: 'Interest' },
  { key: 'goal', label: 'Career' },
  { key: 'style', label: 'Learning style' },
  { key: 'breadth', label: 'Breadth' },
];

function share(weights: Weights, key: WeightKey, goalUsed: boolean): number {
  const total = weights.interest + (goalUsed ? weights.goal : 0) + weights.style + weights.breadth;
  if (key === 'goal' && !goalUsed) return 0;
  return total > 0 ? weights[key] / total : 0;
}

const saveCopy: Record<Exclude<SaveState, 'idle'>, string> = {
  saving: 'Saving',
  saved: 'Saved',
  error: 'Not saved. Move a slider to retry.',
};

export function WeightPanel({ goalUsed }: { goalUsed: boolean }) {
  const { weights, setWeight, resetWeights, isDefaultWeights, saveState } = useCatalogue();
  const enter = useMotionTokens().softEnter('answerFeedback', 2);
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
      <p className="text-[12px] text-muted">Each slider sets a share of your fit score. The list re-ranks as you move.</p>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-1">
        {SLIDERS.map(({ key, label }) => {
          const disabled = key === 'goal' && !goalUsed;
          return (
            <RangeSlider
              key={key}
              label={label}
              value={weights[key]}
              disabled={disabled}
              valueText={disabled ? 'n/a' : `${Math.round(share(weights, key, goalUsed) * 100)}%`}
              onChange={(value) => setWeight(key, value)}
            />
          );
        })}
      </div>
      {!goalUsed && (
        <p className="mt-3 text-[12px] text-muted">
          Career weighting needs a pathway.{' '}
          <Link to={paths.pathways} className="font-medium text-brand underline-offset-2 hover:underline">
            Choose one
          </Link>
        </p>
      )}
      <p className="mt-3 flex h-4 items-center text-[11px] text-muted" aria-live="polite">
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
