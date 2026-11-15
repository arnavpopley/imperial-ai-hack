// The bar that collects modules ticked for comparison (issue 62), pinned to the bottom of the screen and kept
// clear of the advisor bubble in the bottom-right corner.
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { useMotionTokens } from '../../motion/tokens.ts';
import { COMPARE_DOT, COMPARE_LETTERS, MAX_COMPARE, MIN_COMPARE } from './compare.ts';

interface CompareTrayProps {
  selected: readonly { moduleId: string; code: string; title: string }[];
  onRemove: (moduleId: string) => void;
  onClear: () => void;
  onOpen: () => void;
}

export function CompareTray({ selected, onRemove, onClear, onOpen }: CompareTrayProps) {
  const { reduce, transition } = useMotionTokens();
  const ready = selected.length >= MIN_COMPARE;
  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.section
          aria-label="Modules to compare"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={transition('lessonTransition')}
          className="fixed bottom-4 left-4 right-20 z-(--z-sticky) mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2.5 pl-3 shadow-lift backdrop-blur sm:right-24 sm:bottom-6"
        >
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selected.map((m, i) => (
              <li key={m.moduleId}>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 pr-1 pl-2 text-xs font-medium">
                  <span aria-hidden="true" className={`grid size-4 place-items-center rounded-[5px] text-2xs leading-none font-bold text-on-brand ${COMPARE_DOT[i]}`}>
                    {COMPARE_LETTERS[i]}
                  </span>
                  <span className="font-mono text-2xs">{m.code}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(m.moduleId)}
                    className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                  >
                    <Icon name="x" size={13} label={`Remove ${m.title} from the comparison`} />
                  </button>
                </span>
              </li>
            ))}
            {!ready && <li className="text-2xs text-muted">Tick one more to compare (up to {MAX_COMPARE})</li>}
          </ul>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
            <Button size="sm" variant="primary" icon="swap" disabled={!ready} onClick={onOpen}>
              Compare {selected.length}
            </Button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
