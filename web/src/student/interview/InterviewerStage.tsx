// The interviewer, face to face: a stage where the student sees who they are talking to, large and centred,
// as on a video call. Today the stage draws the 2D portrait; it is built so a 3D, talking interviewer can
// replace that portrait without touching any layout.
//
// To plug in a 3D interviewer: write a component with the InterviewerRendererProps below (for example a
// lazily loaded three.js canvas that animates the mouth while `speaking` is true), then point
// `InterviewerRenderer` at it. Everything else (the stage, the name plate, the speaking state, where the
// stage sits in the interview) stays as it is.
import { motion, useReducedMotion } from 'motion/react';
import type { ComponentType } from 'react';
import { cx } from '../../components/cx.ts';
import { InterviewerAvatar } from './InterviewerAvatar.tsx';
import type { Persona } from './personas.ts';

export interface InterviewerRendererProps {
  persona: Persona;
  /** True while the interviewer's reply is streaming; a voice interviewer can drive it from audio later. */
  speaking: boolean;
  /** Height of the figure in pixels; the renderer fills a square of this size. */
  size: number;
}

/** Today's renderer: the 2D portrait with its nod and breathing ring. */
function PortraitRenderer({ persona, speaking, size }: InterviewerRendererProps) {
  return <InterviewerAvatar persona={persona} speaking={speaking} size={size} />;
}

/** The one line to change when the 3D interviewer lands. */
const InterviewerRenderer: ComponentType<InterviewerRendererProps> = PortraitRenderer;

interface InterviewerStageProps {
  persona: Persona;
  speaking: boolean;
  /** hero: the big stage before the chat starts. strip: a compact band pinned above the conversation. */
  layout: 'hero' | 'strip';
  className?: string;
}

export function InterviewerStage({ persona, speaking, layout, className }: InterviewerStageProps) {
  const hero = layout === 'hero';
  // MotionConfig only stops transforms, so the opacity pulse is switched off here for reduced motion.
  const reducedMotion = useReducedMotion();
  const pulse = speaking && !reducedMotion;
  return (
    <div
      className={cx(
        'relative isolate flex items-center overflow-hidden',
        hero ? 'h-56 w-full max-w-md flex-col justify-center rounded-[1.75rem] shadow-soft sm:h-64' : 'h-24 gap-4 px-5 sm:px-8',
        className,
      )}
    >
      {/* Backdrop: the persona's tint fading into the surface, with a soft spotlight behind the figure. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        // Mixed down so the pastel tint reads as a soft wash in dark mode rather than a grey slab.
        style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${persona.tint} 14%, transparent), transparent 75%)` }}
      />
      <motion.div
        aria-hidden="true"
        className={cx(
          'absolute -z-10 rounded-full bg-surface/60 blur-2xl',
          hero ? 'size-48' : 'left-4 size-24',
        )}
        animate={pulse ? { scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] } : { scale: 1, opacity: speaking ? 0.9 : 0.6 }}
        transition={pulse ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      />

      <InterviewerRenderer persona={persona} speaking={speaking} size={hero ? 132 : 64} />

      <div className={cx(hero ? 'mt-4 text-center' : 'min-w-0')}>
        <p className={cx('font-semibold tracking-tight', hero ? 'text-lg' : 'text-base')}>{persona.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden="true"
            className={cx('size-2 rounded-full', speaking ? 'animate-pulse-dot bg-fit-high' : 'bg-line-strong')}
          />
          {speaking ? 'Speaking…' : 'Your interviewer'}
        </p>
      </div>
    </div>
  );
}
