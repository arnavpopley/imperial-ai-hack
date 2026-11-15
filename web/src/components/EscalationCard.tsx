import type { EscalationStatus, EscalationType } from '@modulematch/shared';
import { useId, useState } from 'react';
import { Button } from './Button.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

/** Who each escalation type goes to (spec 11.1). */
export const ESCALATION_QUEUE: Record<EscalationType, string> = {
  RULE_EXCEPTION: 'Senior Tutor',
  LOW_CONFIDENCE: 'personal tutor',
  WELLBEING: 'student support team',
  COMPLAINT: 'admin team',
};

const SUMMARY_MAX = 1000;

interface CommonProps {
  escalationType: EscalationType;
  summary: string;
  className?: string;
}

interface DraftProps extends CommonProps {
  /** The agent's drafted summary, waiting for the student to approve or edit it. */
  variant: 'draft';
  onSend: (summary: string) => void;
  onDiscard: () => void;
  sending: boolean;
  error: string | null;
}

interface SentProps extends CommonProps {
  /** Sent and waiting, or claimed by a member of staff. */
  variant: 'sent';
  status: Exclude<EscalationStatus, 'resolved'>;
  createdAt: string;
}

interface AnsweredProps extends CommonProps {
  /** Staff have replied. */
  variant: 'answered';
  staffResponse: string;
  createdAt: string;
}

export type EscalationCardProps = DraftProps | SentProps | AnsweredProps;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : timeFormat.format(date);
}

export function EscalationCard(props: EscalationCardProps) {
  const queue = ESCALATION_QUEUE[props.escalationType];
  return (
    <section
      aria-label={`Escalation to the ${queue}`}
      className={cx(
        'animate-rise rounded-card border bg-surface shadow-soft',
        props.variant === 'draft' && 'border-mode-escalated/35',
        props.variant === 'sent' && 'border-line',
        props.variant === 'answered' && 'border-fit-high/40',
        props.className,
      )}
    >
      {props.variant === 'draft' && <DraftBody {...props} queue={queue} />}
      {props.variant === 'sent' && <SentBody {...props} queue={queue} />}
      {props.variant === 'answered' && <AnsweredBody {...props} queue={queue} />}
    </section>
  );
}

function CardHeader({ icon, title, detail, tone }: { icon: 'tutor' | 'check' | 'clock'; title: string; detail: string; tone: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cx('grid size-8 shrink-0 place-items-center rounded-full', tone)}>
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[13px] text-muted">{detail}</p>
      </div>
    </div>
  );
}

function DraftBody({ summary, onSend, onDiscard, sending, error, queue }: DraftProps & { queue: string }) {
  const [text, setText] = useState(summary);
  const fieldId = useId();
  const trimmed = text.trim();
  return (
    <form
      className="grid gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSend(trimmed);
      }}
    >
      <CardHeader
        icon="tutor"
        title={`Ask the ${queue}?`}
        detail="I have drafted a summary. Nothing is sent until you approve it, and you can edit it first."
        tone="bg-mode-escalated/12 text-mode-escalated"
      />
      <div>
        <label htmlFor={fieldId} className="text-[13px] font-medium">
          What the {queue} will see
        </label>
        <textarea
          id={fieldId}
          value={text}
          maxLength={SUMMARY_MAX}
          rows={4}
          onChange={(event) => setText(event.target.value)}
          className="mt-1.5 w-full resize-y rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm leading-relaxed focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        />
        <p className="mt-1 text-right text-2xs text-muted tabular-nums">
          {text.length}/{SUMMARY_MAX}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-fit-low">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={sending}>
          Not now
        </Button>
        <Button type="submit" variant="primary" size="sm" icon="send" busy={sending} disabled={!trimmed}>
          Send to the {queue}
        </Button>
      </div>
    </form>
  );
}

function SentBody({ summary, status, createdAt, queue }: SentProps & { queue: string }) {
  const claimed = status === 'claimed';
  return (
    <div className="grid gap-2 p-4">
      <CardHeader
        icon="clock"
        title={claimed ? `The ${queue} is looking at this` : `Sent to the ${queue}`}
        detail={`${claimed ? 'Claimed' : 'Waiting for a reply'} · sent ${formatTime(createdAt)}. Their reply will appear here.`}
        tone="bg-mode-escalated/10 text-mode-escalated"
      />
      <SummaryDetails summary={summary} />
    </div>
  );
}

function AnsweredBody({ summary, staffResponse, createdAt, queue }: AnsweredProps & { queue: string }) {
  return (
    <div className="grid gap-3 p-4">
      <CardHeader
        icon="check"
        title={`Reply from the ${queue}`}
        detail={`About your request from ${formatTime(createdAt)}`}
        tone="bg-fit-high/12 text-fit-high"
      />
      <blockquote className="rounded-xl border-l-4 border-fit-high bg-fit-high/6 px-4 py-3 text-sm leading-relaxed">
        {staffResponse}
      </blockquote>
      <SummaryDetails summary={summary} />
    </div>
  );
}

function SummaryDetails({ summary }: { summary: string }) {
  return (
    <details className="group text-[13px]">
      <summary className="inline-flex cursor-pointer items-center gap-1 rounded text-muted marker:content-none hover:text-ink">
        <Icon name="chevron-down" size={14} className="transition group-open:rotate-180" />
        What you sent
      </summary>
      <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 leading-relaxed">{summary}</p>
    </details>
  );
}
