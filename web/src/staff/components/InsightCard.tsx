// One Insights-agent card (spec 9.3, 10.7): kind, headline, detail, cohort size and, for counterfactuals,
// the average fit uplift. Staff accept, note or dismiss it; nothing changes until they do. Once decided, the
// actions collapse into what happens next and who owns it.
import type { Insight, InsightDecision, InsightKind } from '@modulematch/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router';
import type { StaffDecision } from '../hooks/useInsights.ts';
import { focusRing, plural } from '../lib/format.ts';
import { isSummaryCard, outcomeOf, tagEditorLink } from '../lib/insights.ts';
import { buttonClass, type ButtonVariant } from '../../components/Button.tsx';
import { CheckIcon, ChevronDownIcon, ClockAlertIcon, EyeIcon, NoteIcon, TrendUpIcon, UsersIcon, XIcon } from './icons.tsx';

type IconComponent = ComponentType<Omit<SVGProps<SVGSVGElement>, 'children'>>;

const INSIGHT_KINDS: Record<InsightKind, { label: string; Icon: IconComponent; tint: string; ink: string }> = {
  COUNTERFACTUAL: { label: 'Counterfactual', Icon: TrendUpIcon, tint: 'bg-brand-soft', ink: 'text-brand' },
  OVERLOOKED: { label: 'Overlooked', Icon: EyeIcon, tint: 'bg-mode-explain/10', ink: 'text-mode-explain' },
  DEMAND: { label: 'Demand', Icon: UsersIcon, tint: 'bg-mode-plan/10', ink: 'text-mode-plan' },
  CLASH: { label: 'Timetable clash', Icon: ClockAlertIcon, tint: 'bg-clash-likely/10', ink: 'text-clash-likely' },
};

const DECISION_STATE: Record<InsightDecision, { label: string; className: string }> = {
  pending: { label: 'Awaiting your decision', className: 'bg-fit-mid/15 text-ink' },
  accepted: { label: 'Accepted', className: 'bg-fit-high/10 text-fit-high' },
  noted: { label: 'Noted', className: 'bg-brand-soft text-brand' },
  dismissed: { label: 'Dismissed', className: 'bg-line text-muted' },
};

/** Accept is the one primary action on a card; Note and Dismiss are quieter (issue #142). */
const ACTIONS: { decision: StaffDecision; label: string; Icon: IconComponent; variant: ButtonVariant; active: string }[] = [
  { decision: 'accepted', label: 'Accept', Icon: CheckIcon, variant: 'primary', active: 'border-fit-high bg-fit-high text-on-brand' },
  { decision: 'noted', label: 'Note', Icon: NoteIcon, variant: 'ghost', active: 'border-brand bg-brand text-on-brand' },
  { decision: 'dismissed', label: 'Dismiss', Icon: XIcon, variant: 'ghost', active: 'border-muted bg-muted text-on-brand' },
];

export function InsightCard({
  insight,
  saving,
  error,
  onDecide,
}: {
  insight: Insight;
  saving: boolean;
  error: string | undefined;
  onDecide: (decision: StaffDecision) => void;
}) {
  const kind = INSIGHT_KINDS[insight.kind];
  const state = DECISION_STATE[insight.decision];
  const headingId = useId();
  const detailId = useId();
  const [expanded, setExpanded] = useState(false);
  // Once decided, the actions collapse into what happens next; "Change decision" brings them back.
  const [changing, setChanging] = useState(false);
  const outcome = outcomeOf(insight);
  const collapsed = outcome !== null && !changing;
  const editLink = tagEditorLink(insight);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const interacted = useRef(false);
  const uplift = insight.kind === 'COUNTERFACTUAL' ? insight.upliftPoints : null;

  // The focused button disappears whenever the actions collapse or reopen (a decision, the same decision
  // again, "Change decision", or a failed save that undoes the decision), so focus follows what replaced it.
  useEffect(() => {
    if (!interacted.current) return;
    if (collapsed) outcomeRef.current?.focus();
    else (actionsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? actionsRef.current?.querySelector('button'))?.focus();
  }, [collapsed]);

  const decide = (decision: StaffDecision) => {
    interacted.current = true;
    setChanging(false);
    onDecide(decision);
  };

  const reopen = () => {
    interacted.current = true;
    setChanging(true);
  };

  return (
    <article
      aria-labelledby={headingId}
      className={`flex flex-col gap-5 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line transition-opacity ${
        insight.decision === 'dismissed' ? 'opacity-60' : ''
      }`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${kind.tint} ${kind.ink}`}>
          <kind.Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${kind.ink}`}>
            {isSummaryCard(insight) ? 'Counterfactual summary' : kind.label}
          </p>
          <h3 id={headingId} className="mt-1 text-lg leading-snug font-semibold text-pretty">
            {insight.headline}
          </h3>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? detailId : undefined}
            onClick={() => setExpanded((v) => !v)}
            className={`mt-2 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-brand hover:underline ${focusRing}`}
          >
            {expanded ? 'Hide details' : 'Details'}
            <ChevronDownIcon className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.p
                id={detailId}
                key="detail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                className="overflow-hidden text-sm leading-relaxed text-muted text-pretty"
              >
                <span className="block pt-2">{insight.detail}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {uplift !== null && (
          <div className="col-start-2 justify-self-start rounded-2xl bg-fit-high/10 px-4 py-3 text-center sm:col-start-3">
            <p className="text-2xl leading-none font-semibold tracking-tight text-fit-high tabular-nums">
              {uplift >= 0 ? '+' : ''}
              {uplift} fit
            </p>
            <p className="mt-1 text-2xs text-muted">avg. points</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted">
            <UsersIcon className="size-3.5" />
            {plural(insight.cohortSize, 'student')} behind this card
          </span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${state.className}`} aria-live="polite">
            {saving ? 'Saving…' : state.label}
          </span>
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={reopen}
            className={`inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium text-brand hover:underline ${focusRing}`}
          >
            Change decision
          </button>
        ) : (
          <div ref={actionsRef} role="group" aria-label={`Decision on: ${insight.headline}`} className="flex flex-wrap gap-2">
            {ACTIONS.map(({ decision, label, Icon, variant, active }) => {
              const pressed = insight.decision === decision;
              return (
                <button
                  key={decision}
                  type="button"
                  aria-pressed={pressed}
                  disabled={saving}
                  onClick={() => decide(decision)}
                  className={`${
                    pressed
                      ? `inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium ${active}`
                      : buttonClass(variant)
                  } disabled:cursor-wait ${focusRing}`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {collapsed && outcome && (
        <div
          ref={outcomeRef}
          tabIndex={-1}
          className={`-mt-2 flex flex-wrap items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm outline-none ${
            insight.decision === 'accepted' ? 'bg-fit-high/10' : 'bg-canvas'
          }`}
        >
          <p className="flex items-start gap-2">
            <CheckIcon className={`mt-0.5 size-4 shrink-0 ${insight.decision === 'accepted' ? 'text-fit-high' : 'text-muted'}`} />
            <span>
              <span className="font-medium">{outcome.title}.</span>
              {outcome.owner && <span className="text-muted"> Owner: {outcome.owner}.</span>}
            </span>
          </p>
          {editLink && (
            <Link to={editLink} className={`rounded-lg font-medium text-brand hover:underline ${focusRing}`}>
              Make this change in the tag editor
            </Link>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-fit-low">
          Could not save that decision, so it was undone. {error}
        </p>
      )}
    </article>
  );
}
