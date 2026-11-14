import type { Escalation, StaffEscalation } from '@modulematch/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api.ts';
import { toError } from '../lib/errors.ts';

/** How often the queue is re-fetched so new escalations appear live (demo step 6). */
export const ESCALATION_POLL_MS = 5000;

export interface EscalationQueue {
  items: StaffEscalation[] | null;
  /** Set when the most recent fetch failed; earlier items stay visible. */
  error: Error | null;
  lastUpdated: Date | null;
  unresolvedCount: number;
  /** Escalations that arrived after the first load and have not been opened yet. */
  freshIds: ReadonlySet<string>;
  markSeen: (id: string) => void;
  respond: (id: string, response: string) => Promise<void>;
  retry: () => void;
}

type Reply = Pick<Escalation, 'status' | 'staffResponse'>;

/**
 * A reply this console sent wins over a polled copy that has not caught up yet, so a poll that lands
 * mid-write never flips a resolved escalation back to open. The override is dropped once the server agrees.
 */
function reconcile(list: StaffEscalation[], replies: Map<string, Reply>): StaffEscalation[] {
  for (const e of list) if (replies.has(e.id) && e.status === 'resolved') replies.delete(e.id);
  return list.map((e) => {
    const reply = replies.get(e.id);
    return reply ? { ...e, ...reply } : e;
  });
}

export function useEscalationQueue(intervalMs: number = ESCALATION_POLL_MS): EscalationQueue {
  const [items, setItems] = useState<StaffEscalation[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const replies = useRef(new Map<string, Reply>());
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const list = await api.staff.escalations();
        if (!alive) return;
        const seenBefore = known.current;
        const arrived = seenBefore ? list.filter((e) => !seenBefore.has(e.id)).map((e) => e.id) : [];
        known.current = new Set(list.map((e) => e.id));
        if (arrived.length > 0) setFreshIds((prev) => new Set([...prev, ...arrived]));
        setItems(reconcile(list, replies.current));
        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        if (alive) setError(toError(e));
      }
      // Chain timeouts rather than an interval so a slow response never overlaps the next poll.
      if (alive) timer = setTimeout(tick, intervalMs);
    };

    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [intervalMs, attempt]);

  const markSeen = useCallback((id: string) => {
    setFreshIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const respond = useCallback(async (id: string, response: string) => {
    const updated = await api.staff.respond(id, { response, resolve: true });
    const reply: Reply = { status: updated.status, staffResponse: updated.staffResponse };
    replies.current.set(id, reply);
    setItems((prev) => prev?.map((e) => (e.id === id ? { ...e, ...reply } : e)) ?? prev);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const unresolvedCount = items?.filter((e) => e.status !== 'resolved').length ?? 0;

  return useMemo(
    () => ({ items, error, lastUpdated, unresolvedCount, freshIds, markSeen, respond, retry }),
    [items, error, lastUpdated, unresolvedCount, freshIds, markSeen, respond, retry],
  );
}
