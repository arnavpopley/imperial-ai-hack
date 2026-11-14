// The Module Analyst's rationale with each "REVIEW:" flag highlighted for staff (spec 10.4).
import { Fragment } from 'react';

/** A REVIEW: flag runs to the end of its sentence or line. The capture group keeps flags in split(). */
const REVIEW_FLAG = /(REVIEW:[^\n]*?(?:\.(?=\s|$)|(?=\n)|$))/g;

export const countReviewFlags = (text: string) => text.match(REVIEW_FLAG)?.length ?? 0;

export function Rationale({ text }: { text: string }) {
  const parts = text.split(REVIEW_FLAG);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-line">
      {parts.map((part, i) =>
        // split() with one capture group puts the matches at odd indexes.
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-fit-mid/20 px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
