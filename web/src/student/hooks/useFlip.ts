import { useCallback, useLayoutEffect, useRef } from 'react';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * FLIP reorder animation: when `order` changes, each registered element glides from its old
 * position to its new one. Positions are offsets within the list, so page scroll does not matter.
 */
export function useFlip(order: readonly string[]): (key: string) => (node: HTMLElement | null) => void {
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const refs = useRef(new Map<string, (node: HTMLElement | null) => void>());
  const orderKey = order.join('\n');

  useLayoutEffect(() => {
    const animate = !prefersReducedMotion();
    for (const [key, node] of nodes.current) {
      const top = node.offsetTop;
      const previous = tops.current.get(key);
      tops.current.set(key, top);
      if (!animate || previous === undefined || previous === top) continue;
      node.animate([{ transform: `translateY(${previous - top}px)` }, { transform: 'none' }], {
        duration: 420,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    }
  }, [orderKey]);

  return useCallback((key: string) => {
    let ref = refs.current.get(key);
    if (!ref) {
      ref = (node) => {
        if (node) nodes.current.set(key, node);
        else {
          nodes.current.delete(key);
          tops.current.delete(key);
        }
      };
      refs.current.set(key, ref);
    }
    return ref;
  }, []);
}
