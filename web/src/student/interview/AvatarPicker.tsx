// "Who would you like to talk to?" A disclosure with the interviewer faces as native radios,
// so arrow keys move between them and screen readers announce the group.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { InterviewerAvatar } from './InterviewerAvatar.tsx';
import { choosePersona, PERSONAS, useInterviewer } from './personas.ts';

export function AvatarPicker({ className }: { className?: string }) {
  const persona = useInterviewer();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-3.5 pl-1 text-left shadow-soft transition hover:border-brand/40"
      >
        <InterviewerAvatar persona={persona} size={34} />
        <span className="grid leading-tight">
          <span className="text-2xs text-muted">Talking with</span>
          <span className="text-sm font-semibold">{persona.name}</span>
        </span>
        <Icon name="edit" size={13} className="ml-1 text-muted" label="Change interviewer" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute top-full right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-2xl border border-line bg-surface p-4 shadow-lift"
          >
            <fieldset>
              <legend className="text-sm font-semibold">Choose your interviewer</legend>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {PERSONAS.map((p) => {
                  const selected = p.id === persona.id;
                  return (
                    <label
                      key={p.id}
                      className={cx(
                        'grid cursor-pointer justify-items-center gap-1 rounded-xl p-1.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                        selected ? 'bg-brand-soft' : 'hover:bg-surface-2',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${panelId}-persona`}
                        value={p.id}
                        checked={selected}
                        onChange={() => choosePersona(p.id)}
                        className="sr-only"
                      />
                      <motion.span whileHover={{ y: -2 }} className="block">
                        <InterviewerAvatar persona={p} size={48} />
                      </motion.span>
                      <span className={cx('text-2xs', selected ? 'font-semibold text-brand' : 'text-muted')}>
                        {p.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
