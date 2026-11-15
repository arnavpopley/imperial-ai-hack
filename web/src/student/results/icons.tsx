// Icons the shared set does not have, drawn in the same 24px stroke style as components/Icon.tsx.
import type { ReactNode } from 'react';

interface GlyphProps {
  size?: number;
  className?: string;
}

function Glyph({ size = 16, className, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** A small light bulb: a thought worth keeping in mind, never a warning. */
export function BulbIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.3 1 2.1V18h6v-1.8c0-.8.4-1.6 1-2.1a6.5 6.5 0 0 0-4-11.6z" />
    </Glyph>
  );
}

/** A mark sheet: a page with a few marks on it. */
export function MarkSheetIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
      <path d="M14 2.5V8h5.5M8.5 17v-2.5M12 17v-5M15.5 17v-3.5" />
    </Glyph>
  );
}

/** An upward arrow out of a tray, for the drop zone. */
export function UploadIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M12 15.5V3.5M7 8.5l5-5 5 5M3.5 15v3.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V15" />
    </Glyph>
  );
}
