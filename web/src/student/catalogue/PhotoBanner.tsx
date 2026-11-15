// A slim photo header: an open-licence photo of people (see public/images/CREDITS.md) under the screen title.
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cx } from '../../components/cx.ts';

interface PhotoBannerProps {
  /** File name in /images, without the extension. */
  image: string;
  /** Describes the photo for screen readers. */
  alt: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shown at the top right, for example the sample-data label. */
  aside?: ReactNode;
  /** CSS object-position for the photo, to keep faces in frame. */
  focus?: string;
  className?: string;
}

export function PhotoBanner({ image, alt, title, subtitle, aside, focus = 'center 40%', className }: PhotoBannerProps) {
  const reduce = useReducedMotion();
  return (
    <header
      className={cx(
        'relative isolate overflow-hidden rounded-[1.25rem] border border-line bg-surface-2 shadow-soft',
        className,
      )}
    >
      <motion.img
        src={`/images/${image}.jpg`}
        alt={alt}
        initial={reduce ? false : { scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        style={{ objectPosition: focus }}
        decoding="async"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[rgb(14_16_22/0.78)] via-[rgb(14_16_22/0.5)] to-[rgb(14_16_22/0.1)]"
      />
      <div className="flex min-h-24 flex-wrap items-end justify-between gap-3 px-4 py-4 sm:min-h-40 sm:px-7 sm:py-6">
        <div className="max-w-xl min-w-0 text-white">
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
          {/* Phones keep the banner to a title strip (issue 64), so the content starts in the first screen. */}
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-white/85 text-pretty max-sm:hidden">{subtitle}</p>}
        </div>
        {aside && <div className="rounded-lg bg-surface/90 px-1 py-0.5 backdrop-blur">{aside}</div>}
      </div>
    </header>
  );
}
