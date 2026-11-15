// Detail pane for one escalation: the approved summary, the student's context and the reply box. Rule exceptions
// also show what the request shares (the broken rule, the reason, completed modules and fit) and take a decision.
import type { ExceptionRequest, StaffEscalation } from '@modulematch/shared';
import { useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ESCALATION_TYPES, StatusBadge, TypeBadge } from '../components/EscalationBadges.tsx';
import { Button, EmptyState } from '../components/ui.tsx';
import { AlertIcon, ArrowLeftIcon, CheckIcon, HeartIcon, InboxIcon, XIcon } from '../components/icons.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { DECISION_LABELS, MAX_REPLY, respondBody, ruleRows, subScoreText, type StaffAction } from '../lib/exceptionCase.ts';
import { focusRing, formatDateTime } from '../lib/format.ts';
import { errorMessage } from '../lib/errors.ts';
import { useStaffData } from '../StaffData.tsx';

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
  const ids = { title: useId(), summary: useId(), context: useId(), request: useId(), reply: useId() };
  const declined = e.decision === 'declined';

  useEffect(() => markSeen(e.id), [markSeen, e.id]);

  return (
    <article
      aria-labelledby={ids.title}
      className="grid gap-7 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg"
    >
      <header className="flex flex-wrap items-start gap-4">
        <Avatar seed={e.sessionId} size={64} />
        <div className="grid min-w-0 flex-1 gap-2">
          <h2 id={ids.title} className="text-2xl font-semibold tracking-tight">
            {type.label} for the {type.queue}
          </h2>
          <p className="text-sm text-muted">
            {e.studentContext.programme}, Year {e.studentContext.yearOfStudy} ·{' '}
            <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={e.type} />
            <StatusBadge status={e.status} />
          </div>
        </div>
      </header>

      {e.type === 'WELLBEING' && (
        <p className="flex items-start gap-3 rounded-2xl bg-mode-plan/10 p-4 text-sm leading-relaxed">
          <HeartIcon className="mt-0.5 text-mode-plan" />
          The student consented to this hand-off. The advisor has stopped advising and shown support contacts; please
          reply as a person, not as the advisor.
        </p>
      )}

      <section aria-labelledby={ids.summary}>
        <h3 id={ids.summary} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          What the student is asking
        </h3>
        <blockquote className="mt-3 rounded-2xl border-l-4 border-brand bg-brand-soft/50 px-5 py-4 text-base leading-relaxed">
          {e.summary}
        </blockquote>
        <p className="mt-2 text-xs text-muted">Drafted by the AI, then read and approved by the student.</p>
      </section>

      {e.type === 'RULE_EXCEPTION' && e.request && <ExceptionDetails headingId={ids.request} request={e.request} />}

      <section aria-labelledby={ids.context} className="rounded-2xl bg-surface-2 p-5">
        <h3 id={ids.context} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Student context
        </h3>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
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
                  <li key={id} className="rounded-full border border-line bg-surface px-3 py-1">
                    {moduleTitle(id)}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
      </section>

      {e.status === 'resolved' ? (
        <section
          aria-labelledby={ids.reply}
          className={`rounded-2xl border p-5 ${declined ? 'border-line bg-surface-2' : 'border-fit-high/30 bg-fit-high/5'}`}
        >
          <h3
            id={ids.reply}
            className={`flex items-center gap-1.5 text-sm font-medium ${declined ? 'text-ink' : 'text-fit-high'}`}
          >
            {declined ? <XIcon /> : <CheckIcon />}
            {e.decision
              ? `${DECISION_LABELS[e.decision]}. The decision is in the student's session`
              : "Resolved. The reply is in the student's session"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
            {e.staffResponse ?? 'Resolved without a written reply.'}
          </p>
        </section>
      ) : (
        <ReplyBox escalation={e} />
      )}
    </article>
  );
}

/** What the student agreed to share with the Senior Tutor when they sent the request, and nothing more. */
function ExceptionDetails({ headingId, request }: { headingId: string; request: ExceptionRequest }) {
  const { moduleTitle, moduleCode } = useStaffData();
  const named = (id: string) => {
    const code = moduleCode(id);
    return code ? `${code} ${moduleTitle(id)}` : moduleTitle(id);
  };
  const rows = ruleRows(request.violations);

  return (
    <section aria-labelledby={headingId} className="rounded-2xl bg-surface-2 p-5">
      <h3 id={headingId} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        The request
      </h3>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted">Module</dt>
        <dd>
          {request.moduleId ? named(request.moduleId) : <span className="text-muted">No single module: a programme rule</span>}
        </dd>

        <dt className="text-muted">Rule broken</dt>
        <dd>
          {rows.length === 0 ? (
            <span className="text-muted">The rules engine found no broken rule when this was sent.</span>
          ) : (
            <ul className="grid gap-2">
              {rows.map((row, i) => (
                <li key={`${row.code}-${i}`} className="rounded-xl border border-line bg-surface px-3 py-2">
                  <p className="font-medium">
                    {row.label} <span className="font-mono text-xs font-normal text-muted">{row.code}</span>
                  </p>
                  {row.prerequisiteId && (
                    <p className="mt-0.5 text-xs text-muted">
                      Missing: <span className="text-ink">{named(row.prerequisiteId)}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs leading-relaxed text-muted">{row.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </dd>

        <dt className="text-muted">Reason given</dt>
        <dd>{request.reason ? <q>{request.reason}</q> : <span className="text-muted">No reason given</span>}</dd>

        <dt className="text-muted">Fit for the module</dt>
        <dd>
          {request.fit ? (
            <span>
              <span className="font-semibold tabular-nums">{request.fit.fit}</span>
              <span className="text-muted"> / 100 · </span>
              <span className="text-xs text-muted tabular-nums">{subScoreText(request.fit.sub)}</span>
            </span>
          ) : (
            <span className="text-muted">Not scored</span>
          )}
        </dd>

        <dt className="text-muted">Completed modules</dt>
        <dd>
          {request.completedModuleIds.length === 0 ? (
            <span className="text-muted">None recorded</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {request.completedModuleIds.map((id) => (
                <li key={id} className="rounded-full border border-line bg-surface px-3 py-1">
                  {named(id)}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
      <p className="mt-3 text-xs text-muted">Shared by the student with this request, as it stood when they sent it.</p>
    </section>
  );
}

type SendState = { status: 'idle' } | { status: 'sending'; action: StaffAction } | { status: 'error'; message: string };

const SENDING: Record<StaffAction, string> = { approve: 'Approving…', decline: 'Declining…', reply: 'Sending…' };

function ReplyBox({ escalation }: { escalation: StaffEscalation }) {
  const { queue } = useStaffData();
  const [text, setText] = useState('');
  const [send, setSend] = useState<SendState>({ status: 'idle' });
  const fieldId = useId();
  const hintId = useId();
  const trimmed = text.trim();
  // Rule exceptions take a decision, with the message optional; every other case takes a written reply.
  const decides = escalation.type === 'RULE_EXCEPTION';
  const busy = send.status === 'sending';

  const submit = async (action: StaffAction) => {
    const body = respondBody(action, text);
    if (!body) return;
    setSend({ status: 'sending', action });
    try {
      await queue.respond(escalation.id, body);
      // On success the escalation is resolved and this box unmounts.
    } catch (err) {
      setSend({ status: 'error', message: errorMessage(err) });
    }
  };

  const label = (action: StaffAction, idle: string) =>
    send.status === 'sending' && send.action === action ? SENDING[action] : idle;

  return (
    <form
      className="grid gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!decides && trimmed) void submit('reply');
      }}
    >
      <label htmlFor={fieldId} className="text-sm font-medium">
        {decides ? 'Message to the student (optional)' : 'Reply to the student'}
      </label>
      <textarea
        id={fieldId}
        aria-describedby={hintId}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        maxLength={MAX_REPLY}
        rows={decides ? 4 : 6}
        placeholder={
          decides
            ? 'For example: Please work through the bridging notes before week 3.'
            : 'For example: Thanks for raising this. I have passed it to the module lead and will update you by Friday.'
        }
        className={`w-full resize-y rounded-2xl border border-line bg-canvas p-4 text-sm leading-relaxed placeholder:text-muted ${focusRing}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-muted">
          {decides ? decisionHint(escalation) : "Sending marks this resolved and shows the reply in the student's session."}{' '}
          <span className="tabular-nums">
            {text.length}/{MAX_REPLY}
          </span>
        </p>
        {decides ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void submit('decline')}>
              <XIcon /> {label('decline', 'Decline')}
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit('approve')}>
              <CheckIcon /> {label('approve', 'Approve exception')}
            </Button>
          </div>
        ) : (
          <Button type="submit" variant="primary" disabled={!trimmed || busy}>
            {label('reply', 'Send reply and resolve')}
          </Button>
        )}
      </div>
      {send.status === 'error' && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-fit-low">
          <AlertIcon /> Could not send the reply: {send.message}
        </p>
      )}
    </form>
  );
}

function decisionHint(escalation: StaffEscalation): string {
  return escalation.request?.moduleId
    ? 'Approving opens the module to this student only, so they can shortlist it. Either decision resolves the case and appears in their session.'
    : 'No single module is named, so the decision is recorded and shown to the student, but no module opens up.';
}
