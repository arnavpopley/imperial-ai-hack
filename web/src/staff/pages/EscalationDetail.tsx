// Detail pane for one escalation: the approved summary, the student's context and the reply box.
import { schemas } from '@modulematch/shared';
import type { StaffEscalation } from '@modulematch/shared';
import { useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ESCALATION_TYPES, StatusBadge, TypeBadge } from '../components/EscalationBadges.tsx';
import { Button, EmptyState } from '../components/ui.tsx';
import { AlertIcon, ArrowLeftIcon, CheckIcon, HeartIcon, InboxIcon } from '../components/icons.tsx';
import { focusRing, formatDateTime } from '../lib/format.ts';
import { errorMessage } from '../lib/errors.ts';
import { useStaffData } from '../StaffData.tsx';

const MAX_REPLY = schemas.EscalationRespondBody.shape.response.maxLength ?? 2000;

export function EscalationDetail() {
  const { escalationId = '' } = useParams();
  const { queue } = useStaffData();
  const escalation = queue.items?.find((e) => e.id === escalationId);

  return (
    <div className="grid gap-3">
      <Link
        to="/staff/escalations"
        className={`inline-flex items-center gap-1 justify-self-start rounded text-sm text-muted hover:text-ink lg:hidden ${focusRing}`}
      >
        <ArrowLeftIcon /> Back to the queue
      </Link>
      {escalation ? (
        // Keyed so a half-written reply never carries over to another student's case.
        <EscalationCase key={escalation.id} escalation={escalation} />
      ) : (
        <EmptyState icon={<InboxIcon className="size-6" />} title="Escalation not found">
          It may have been removed. Pick another from the queue.
        </EmptyState>
      )}
    </div>
  );
}

function EscalationCase({ escalation: e }: { escalation: StaffEscalation }) {
  const { queue, moduleTitle } = useStaffData();
  const { markSeen } = queue;
  const type = ESCALATION_TYPES[e.type];
  const ids = { title: useId(), summary: useId(), context: useId(), reply: useId() };

  useEffect(() => markSeen(e.id), [markSeen, e.id]);

  return (
    <article aria-labelledby={ids.title} className="grid gap-5 rounded-card border border-line bg-surface p-5">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={e.type} />
          <StatusBadge status={e.status} />
          <time dateTime={e.createdAt} className="ml-auto text-xs text-muted">
            {formatDateTime(e.createdAt)}
          </time>
        </div>
        <h2 id={ids.title} className="text-lg font-semibold tracking-tight">
          {type.label} for the {type.queue}
        </h2>
      </header>

      {e.type === 'WELLBEING' && (
        <p className="flex items-start gap-2 rounded-lg bg-mode-plan/10 p-3 text-sm">
          <HeartIcon className="mt-0.5 text-mode-plan" />
          The student consented to this hand-off. The advisor has stopped advising and shown support contacts; please
          reply as a person, not as the advisor.
        </p>
      )}

      <section aria-labelledby={ids.summary}>
        <h3 id={ids.summary} className="text-xs font-medium text-muted">
          Summary, drafted by the agent and approved by the student
        </h3>
        <blockquote className="mt-1.5 border-l-2 border-brand pl-3 text-sm leading-relaxed">{e.summary}</blockquote>
      </section>

      <section aria-labelledby={ids.context} className="rounded-lg bg-canvas p-4">
        <h3 id={ids.context} className="text-xs font-medium text-muted">
          Student context
        </h3>
        <dl className="mt-2 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted">Programme</dt>
          <dd>{e.studentContext.programme}</dd>
          <dt className="text-muted">Year</dt>
          <dd>Year {e.studentContext.yearOfStudy}</dd>
          <dt className="text-muted">Shortlist</dt>
          <dd>
            {e.studentContext.shortlist.length === 0 ? (
              <span className="text-muted">Nothing shortlisted yet</span>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {e.studentContext.shortlist.map((id) => (
                  <li key={id} className="rounded-md border border-line bg-surface px-2 py-0.5">
                    {moduleTitle(id)}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
      </section>

      {e.status === 'resolved' ? (
        <section aria-labelledby={ids.reply} className="rounded-lg border border-fit-high/30 bg-fit-high/5 p-4">
          <h3 id={ids.reply} className="flex items-center gap-1.5 text-sm font-medium text-fit-high">
            <CheckIcon /> Resolved. The reply is in the student's session
          </h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
            {e.staffResponse ?? 'Resolved without a written reply.'}
          </p>
        </section>
      ) : (
        <ReplyBox escalationId={e.id} />
      )}
    </article>
  );
}

type SendState = { status: 'idle' } | { status: 'sending' } | { status: 'error'; message: string };

function ReplyBox({ escalationId }: { escalationId: string }) {
  const { queue } = useStaffData();
  const [text, setText] = useState('');
  const [send, setSend] = useState<SendState>({ status: 'idle' });
  const fieldId = useId();
  const hintId = useId();
  const trimmed = text.trim();

  const submit = async () => {
    setSend({ status: 'sending' });
    try {
      await queue.respond(escalationId, trimmed);
      // On success the escalation is resolved and this box unmounts.
    } catch (err) {
      setSend({ status: 'error', message: errorMessage(err) });
    }
  };

  return (
    <form
      className="grid gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (trimmed) void submit();
      }}
    >
      <label htmlFor={fieldId} className="text-sm font-medium">
        Reply to the student
      </label>
      <textarea
        id={fieldId}
        aria-describedby={hintId}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        maxLength={MAX_REPLY}
        rows={5}
        placeholder="For example: I have approved a prerequisite waiver. Please complete the bridging notes before week 3."
        className={`w-full resize-y rounded-lg border border-line bg-canvas p-3 text-sm leading-relaxed placeholder:text-muted ${focusRing}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-muted">
          Sending marks this resolved and shows the reply in the student's session.{' '}
          <span className="tabular-nums">
            {text.length}/{MAX_REPLY}
          </span>
        </p>
        <Button type="submit" variant="primary" disabled={!trimmed || send.status === 'sending'}>
          {send.status === 'sending' ? 'Sending…' : 'Send reply and resolve'}
        </Button>
      </div>
      {send.status === 'error' && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-fit-low">
          <AlertIcon /> Could not send the reply: {send.message}
        </p>
      )}
    </form>
  );
}
