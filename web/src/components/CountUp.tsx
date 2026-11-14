// A number that counts up from zero when it first renders, and eases to each new value after that.
// Under prefers-reduced-motion it shows the final value at once.
import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** Decimal places to show. */
  decimals?: number;
  /** Text after the number, for example "%". */
  suffix?: string;
  /** Seconds. */
  duration?: number;
}

export function CountUp({ value, decimals = 0, suffix = '', duration = 0.9 }: CountUpProps) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  const text = `${shown.toFixed(decimals)}${suffix}`;
  const final = `${value.toFixed(decimals)}${suffix}`;
  return (
    <>
      {/* Screen readers get the final value, not every frame. */}
      <span aria-hidden="true" className="tabular-nums">
        {text}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
