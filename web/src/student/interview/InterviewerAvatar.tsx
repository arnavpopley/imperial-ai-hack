// The interviewer's face. `speaking` drives a gentle nod and a breathing ring: today it follows streamed
// tokens, and a voice interviewer can drive the same prop from audio playback later.
import { cx } from '../../components/cx.ts';
import { personaAvatarUri, type Persona } from './personas.ts';
import './interview.css';

interface InterviewerAvatarProps {
  persona: Persona;
  speaking?: boolean;
  /** Pixel size of the round face. */
  size?: number;
  /** Decorative by default, because the name sits beside the face in text. */
  label?: string;
  className?: string;
}

export function InterviewerAvatar({ persona, speaking = false, size = 40, label, className }: InterviewerAvatarProps) {
  return (
    <span
      className={cx('mm-avatar relative inline-grid shrink-0 place-items-center', className)}
      data-speaking={speaking}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span
        className="mm-avatar-ring absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 0 3px ${persona.tint}`, opacity: speaking ? undefined : 0 }}
      />
      <span
        className="mm-avatar-face block size-full overflow-hidden rounded-full ring-2 ring-surface"
        style={{ backgroundColor: persona.tint }}
      >
        <img
          src={personaAvatarUri(persona)}
          alt=""
          width={size}
          height={size}
          className="size-full"
          draggable={false}
        />
      </span>
    </span>
  );
}
