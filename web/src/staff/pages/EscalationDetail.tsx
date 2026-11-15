// Detail pane for one escalation: the approved summary, the student's context and the reply box. Rule exceptions
// also show what the request shares (the broken rule, the reason, completed modules and fit) and take a decision.
// Issue 107: the request and its decision come first and fit a 1440×900 screen; the student context follows.
import type { ExceptionRequest, StaffEscalation } from '@modulematch/shared';
import { useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ESCALATION_TYPES, StatusBadge } from '../components/EscalationBadges.tsx';
import { Button } from '../../components/Button.tsx';
import { EmptyState } from '../../components/StateViews.tsx';
import { AlertIcon, ArrowLeftIcon, CheckIcon, HeartIcon, XIcon } from '../components/icons.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { SubScoreBars } from '../../components/SubScoreBars.tsx';
import { escalationTitle } from '../../components/escalationTitle.ts';
import { useModuleLookup } from '../hooks/useModuleLookup.ts';
import {
  approvalOpensModule,
  DECISION_LABELS,
  MAX_REPLY,
  respondBody,
  ruleRows,
  type StaffAction,
} from '../lib/exceptionCase.ts';
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
        <EmptyState icon="inbox" title="Escalation not found">
          It may have been removed. Pick another from the queue.
        </EmptyState>
      )}
    </div>
  );
}

function EscalationCase({ escalation: e }: { escalation: StaffEscalation }) {
  const { queue, moduleTitle } = useStaffData();
  const { moduleByIdForTitle } = useModuleLookup();
  const { markSeen } = queue;
  const type = ESCALATION_TYPES[e.type];
  // The request panel lays out the same facts as the summary, so the summary shrinks to one line there.
  const detailed = e.type === 'RULE_EXCEPTION' && e.request !== null;
  const ids = { title: useId(), summary: useId(), context: useId(), request: useId(), reply: useId() };
  const declined = e.decision === 'declined';

  useEffect(() => markSeen(e.id), [markSeen, e.id]);

  return (
    <article
      aria-labelledby={ids.title}
      className="grid min-w-0 gap-3 rounded-panel bg-surface p-5 shadow-soft ring-1 ring-line"
    >
      <header className="flex items-start gap-3">
        <Avatar seed={e.sessionId} size={40} />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex items-start justify-between gap-3">
            <h2 id={ids.title} className="min-w-0 text-heading">
              {escalationTitle(e, moduleByIdForTitle)}
            </h2>
            <span className="mt-0.5 shrink-0">
              <StatusBadge status={e.status} />
            </span>
          </div>
          <p className="text-sm text-muted">
            For the {type.queue} · {e.studentContext.programme}, Year {e.studentContext.yearOfStudy} ·{' '}
            <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
          </p>
        </div>
      </header>

      {e.type === 'WELLBEING' && (
        <p className="flex items-start gap-3 rounded-2xl bg-mode-plan/10 p-4 text-sm leading-relaxed">
          <HeartIcon className="mt-0.5 text-mode-plan" />
          The student consented to this hand-off. The advisor has stopped advising and shown support contacts; please
          reply as a person, not as the advisor.
        </p>
      )}

      <section aria-labelledby={ids.summary} className="min-w-0">
        <h3 id={ids.summary} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          What the student is asking
          <span className="font-normal tracking-normal normal-case">Drafted by the AI, approved by the student</span>
        </h3>
        {detailed ? (
          // The facts are laid out below, so one line here, with the full approved text a click away.
          <details className="group mt-2 min-w-0 rounded-2xl border-l-4 border-brand bg-brand-soft/50 px-4 py-2.5 text-sm leading-relaxed">
            <summary className="flex cursor-pointer list-none items-baseline gap-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 truncate group-open:hidden">{e.summary}</span>
              <span className="hidden flex-1 group-open:inline">Full summary</span>
              <span className="shrink-0 text-xs font-medium text-brand">
                <span className="group-open:hidden">Full summary</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <p className="mt-2">{e.summary}</p>
          </details>
        ) : (
          <blockquote className="mt-2 rounded-2xl border-l-4 border-brand bg-brand-soft/50 px-4 py-3 text-base leading-relaxed">
            {e.summary}
          </blockquote>
        )}
      </section>

      {detailed && e.request && <ExceptionDetails headingId={ids.request} request={e.request} />}

      {e.status === 'resolved' ? (
        <ResolvedNote escalation={e} headingId={ids.reply} declined={declined} />
      ) : (
        <ReplyBox escalation={e} />
      )}

      <section aria-labelledby={ids.context} className="rounded-2xl bg-surface-2 px-4 py-3">
        <h3 id={ids.context} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Student context
        </h3>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
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
    </article>
  );
}

function ResolvedNote({ escalation: e, headingId, declined }: { escalation: StaffEscalation; headingId: string; declined: boolean }) {
  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl border p-4 ${declined ? 'border-line bg-surface-2' : 'border-fit-high/30 bg-fit-high/5'}`}
    >
      <h3 id={headingId} className={`flex items-center gap-1.5 text-sm font-medium ${declined ? 'text-ink' : 'text-fit-high'}`}>
        {declined ? <XIcon /> : <CheckIcon />}
        {e.decision
          ? `${DECISION_LABELS[e.decision]}. The decision is in the student's session`
          : "Resolved. The reply is in the student's session"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{e.staffResponse ?? 'Resolved without a written reply.'}</p>
    </section>
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
    <section aria-labelledby={headingId} className="rounded-2xl bg-surface-2 px-4 py-3">
      <h3 id={headingId} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        The request
        <span className="font-normal tracking-normal normal-case">Shared by the student, as it stood when they sent it</span>
      </h3>
      <dl className="mt-2 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        {/* The title names the module, so a row is only needed when the request names none. */}
        {!request.moduleId && (
          <>
            <dt className="text-muted">Module</dt>
            <dd className="text-muted">No single module: a programme rule</dd>
          </>
        )}

        <dt className="text-muted">Rule broken</dt>
        <dd>
          {rows.length === 0 ? (
            <span className="text-muted">The rules engine found no broken rule when this was sent.</span>
          ) : (
            <ul className="grid gap-1.5">
              {rows.map((row, i) => (
                // Plain labels only (issue 107). The full rule sentence opens on click, tap or Enter, so the numbers
                // behind a rule (the credit total and cap, for example) stay reachable without a mouse.
                <li key={`${row.code}-${i}`} className="rounded-xl border border-line bg-surface px-3 py-1">
                  <details className="group">
                    <summary className={`flex cursor-pointer list-none items-baseline gap-2 rounded [&::-webkit-details-marker]:hidden ${focusRing}`}>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{row.label}</span>
                        {row.prerequisiteId && (
                          <span className="text-muted">
                            {' '}
                            · missing <span className="text-ink">{named(row.prerequisiteId)}</span>
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-brand">
                        <span className="group-open:hidden">Details</span>
                        <span className="hidden group-open:inline">Hide</span>
                      </span>
                    </summary>
                    <p className="mt-1 pb-1 text-xs leading-relaxed text-muted">{row.detail}</p>
                  </details>
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
            <div className="grid max-w-sm gap-1.5">
              <span>
                <span className="font-semibold tabular-nums">{request.fit.fit}</span>
                <span className="text-muted"> / 100</span>
              </span>
              {/* The same four factor colours the student sees on their catalogue cards (issue 137). */}
              <SubScoreBars sub={request.fit.sub} variant="compact" />
            </div>
          ) : (
            <span className="text-muted">Not scored</span>
          )}
        </dd>

        <dt className="text-muted">Completed modules</dt>
        <dd>
          {request.completedModuleIds.length === 0 ? (
            <span className="text-muted">None recorded</span>
          ) : (
            // Folded, so the decision stays on the first screen; one click shows them all.
            <details className="group">
              <summary className="cursor-pointer text-brand marker:text-muted">
                {request.completedModuleIds.length} modules
                <span className="group-open:hidden">, show them</span>
              </summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {request.completedModuleIds.map((id) => (
                  <li key={id} className="rounded-full border border-line bg-surface px-3 py-1">
                    {named(id)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </dd>
      </dl>
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
      // Sticks to the bottom of the detail pane while the request above it scrolls (wide screens only).
      className="grid gap-2 lg:sticky lg:bottom-0 lg:z-10 lg:-mx-5 lg:-mb-5 lg:border-t lg:border-line lg:bg-surface lg:px-5 lg:pt-3 lg:pb-4"
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
        rows={decides ? 2 : 5}
        placeholder={
          decides
            ? 'For example: Please work through the bridging notes before week 3.'
            : 'For example: Thanks for raising this. I have passed it to the module lead and will update you by Friday.'
        }
        className={`w-full resize-y rounded-2xl border border-line bg-canvas px-4 py-2 text-sm leading-relaxed placeholder:text-muted ${focusRing}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p id={hintId} className="min-w-0 flex-1 text-xs text-muted">
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
  return approvalOpensModule(escalation.request)
    ? 'Approving opens the module to this student only; its credits still count towards the cap.'
    : 'No module rule can be waived here (the credit cap always applies); the decision is recorded and shown to the student.';
}
