// A generated avatar for people we have no photo of (synthetic students). DiceBear draws a friendly,
// abstract face from a seed, so the same id always gets the same avatar and no real likeness is implied.
import { thumbs } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';
import { useMemo } from 'react';
import { cx } from './cx.ts';

interface AvatarProps {
  /** Any stable id, for example an escalation or session id. */
  seed: string;
  /** Pixel size of the round avatar. */
  size?: number;
  className?: string;
  /** Accessible name. Without it the avatar is decorative. */
  label?: string;
}

export function Avatar({ seed, size = 40, className, label }: AvatarProps) {
  const src = useMemo(() => createAvatar(thumbs, { seed, radius: 50 }).toDataUri(), [seed]);
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={cx('shrink-0 rounded-full bg-surface-2 ring-2 ring-surface', className)}
    />
  );
}
