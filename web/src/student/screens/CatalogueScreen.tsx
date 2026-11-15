// Screen 3: ranked module cards with what-if weights, confidence handling (spec 8.6),
// eligibility (spec 8.7), filters and a shortlist toggle on each card.
import { STARTER_QUESTIONS, type Module, type Term } from '@modulematch/shared';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, buttonClass } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { MODULE_TYPE_LABELS } from '../../components/ModuleTypeChip.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { ModuleCard } from '../catalogue/ModuleCard.tsx';
import { PhotoBanner } from '../catalogue/PhotoBanner.tsx';
import { WeightPanel } from '../catalogue/WeightPanel.tsx';
import { useChat } from '../chat/ChatProvider.tsx';
import { useFlip } from '../hooks/useFlip.ts';
import { useShortlist } from '../hooks/useShortlist.ts';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { TERM_LABELS, TERMS } from '../labels.ts';
import { paths } from '../routes.ts';
import { useAdvisor } from '../shell/StudentShell.tsx';
import { useCatalogue } from '../state/CatalogueProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { yourDataPath } from '../yourdata/paths.ts';

type TypeFilter = 'all' | Module['type'];
type TermFilter = 'all' | Term;

const TYPE_OPTIONS: readonly { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'core', label: MODULE_TYPE_LABELS.core },
  { value: 'elective', label: MODULE_TYPE_LABELS.elective },
  { value: 'i-explore', label: MODULE_TYPE_LABELS['i-explore'] },
];

const TERM_OPTIONS: readonly { value: TermFilter; label: string }[] = [
  { value: 'all', label: 'Any' },
  ...TERMS.map((t) => ({ value: t, label: TERM_LABELS[t] })),
];

export function CatalogueScreen() {
  const { recs, ranked, scored } = useCatalogue();
  const { openAdvisor } = useAdvisor();
  const shortlist = useShortlist();
  const [type, setType] = useState<TypeFilter>('all');
  const [term, setTerm] = useState<TermFilter>('all');
  const [onlyShortlisted, setOnlyShortlisted] = useState(false);

  const visible = ranked.filter(
    (r) =>
      (type === 'all' || r.module?.type === type) &&
      (term === 'all' || r.module?.terms.includes(term)) &&
      (!onlyShortlisted || shortlist.isShortlisted(r.moduleId)),
  );
  const flipRef = useFlip(visible.map((r) => r.moduleId));
  const eligibleCount = visible.filter((r) => r.eligible).length;
  const confidence = recs.data?.confidence ?? 'high';
  const goalUsed = ranked.some((r) => r.sub.goal !== null);
  const filtered = type !== 'all' || term !== 'all' || onlyShortlisted;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PhotoBanner
        image="catalogue-study-group"
        alt="A group of students studying together around a table"
        title="Your modules"
        subtitle={
          scored
            ? 'Ranked by how well each one fits you. Open any module to see why, read a summary or ask about it.'
            : 'Modules for your year first, then the ones students like you shortlist. Tell us what you enjoy to rank them by fit.'
        }
        aside={<SampleDataLabel />}
        focus="center 35%"
      />

      {recs.data && !scored && <StarterNotice />}
      {recs.data && scored && confidence !== 'high' && <ConfidenceNotice level={confidence} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4 lg:sticky lg:top-20">
          <WeightPanel goalUsed={goalUsed} />
          <section aria-label="Filters" className="grid gap-3 rounded-card border border-line bg-surface p-4 shadow-soft">
            <SegmentedControl legend="Module type" options={TYPE_OPTIONS} value={type} onChange={setType} />
            <SegmentedControl legend="Term" options={TERM_OPTIONS} value={term} onChange={setTerm} />
            <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] font-medium">
              Shortlisted only
              <input
                type="checkbox"
                checked={onlyShortlisted}
                onChange={(event) => setOnlyShortlisted(event.target.checked)}
                className="size-4 accent-brand"
              />
            </label>
          </section>
        </div>

        <section aria-labelledby="ranked-heading" className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="ranked-heading" className="text-[13px] font-medium text-muted" aria-live="polite">
              {recs.data ? `${visible.length} modules · ${eligibleCount} open to you` : 'Loading your ranking'}
            </h2>
            {recs.loading && recs.data && <span className="text-[12px] text-muted">Updating…</span>}
          </div>

          {shortlist.error && (
            <p role="alert" className="mb-3 text-[13px] text-fit-low">
              Could not update the shortlist: {shortlist.error}
            </p>
          )}

          {!recs.data && recs.loading && <CardSkeletons />}
          {!recs.data && recs.error && <ErrorState message={recs.error} onRetry={recs.reload} />}
          {recs.data && visible.length === 0 && (
            <EmptyState
              icon="grid"
              title={filtered ? 'No modules match these filters' : 'No modules to rank yet'}
              action={
                filtered && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setType('all');
                      setTerm('all');
                      setOnlyShortlisted(false);
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            >
              {filtered ? 'Try another term or type.' : 'Your recommendations appear here once the interview has enough to go on.'}
            </EmptyState>
          )}
          {visible.length > 0 && (
            <ol className="relative grid gap-4">
              {visible.map((item, index) => (
                <RankedRow key={item.moduleId} first={index === eligibleCount && !item.eligible}>
                  <ModuleCard
                    item={item}
                    lowConfidence={confidence === 'low'}
                    scored={scored}
                    shortlisted={shortlist.isShortlisted(item.moduleId)}
                    pending={shortlist.isPending(item.moduleId)}
                    onToggleShortlist={() => void shortlist.toggle(item.moduleId)}
                    onAsk={openAdvisor}
                    listRef={flipRef(item.moduleId)}
                    index={index}
                  />
                </RankedRow>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/** Puts a divider above the first ineligible module, so the gate reads as a separate group. */
function RankedRow({ first, children }: { first: boolean; children: ReactNode }) {
  if (!first) return children;
  return (
    <>
      <li aria-hidden="true" className="mt-3 flex items-center gap-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        Not open to you yet
        <span className="h-px flex-1 bg-line" />
      </li>
      {children}
    </>
  );
}

/**
 * Spec 8.6 cold start: the student skipped the interview, so there is nothing to score. Says so plainly and
 * offers a few questions, rather than fake precision or a tutor escalation.
 */
function StarterNotice() {
  const navigate = useNavigate();
  const { session } = useReadySession();
  const { save, saving, error } = useProfileActions();
  // Spec 12: only RECOMMEND returns to the interview. Elsewhere (planning a timetable, say) the profile
  // is edited in "Your data" instead.
  const canResume = session.mode === 'RECOMMEND';
  return (
    <div role="status" className="animate-rise flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-fit-mid/35 bg-fit-mid/8 px-4 py-3">
      <Icon name="info" size={18} className="shrink-0 text-fit-mid" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">We know little about you yet</p>
        <p className="text-[13px] text-muted">
          There are no fit scores until you tell us what you enjoy. This is a starter order, not a recommendation.
        </p>
        {error && (
          <p role="alert" className="mt-1 text-[13px] text-fit-low">
            {error}
          </p>
        )}
      </div>
      {canResume ? (
        <Button
          size="sm"
          variant="primary"
          icon="chat"
          busy={saving}
          onClick={() => void save({ resumeInterview: true }).then((saved) => saved?.mode === 'INTERVIEW' && navigate(paths.interview))}
        >
          Answer {STARTER_QUESTIONS} quick questions
        </Button>
      ) : (
        <Link to={yourDataPath} className={buttonClass('secondary', 'sm')}>
          Add your interests
        </Link>
      )}
    </div>
  );
}

function ConfidenceNotice({ level }: { level: 'medium' | 'low' }) {
  const navigate = useNavigate();
  const { send, sending } = useChat();
  const medium = level === 'medium';
  return (
    <div
      role="status"
      className={cx(
        'animate-rise flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border px-4 py-3',
        medium ? 'border-fit-mid/35 bg-fit-mid/8' : 'border-fit-low/30 bg-fit-low/6',
      )}
    >
      <Icon name="info" size={18} className={cx('shrink-0', medium ? 'text-fit-mid' : 'text-fit-low')} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{medium ? 'These scores could be sharper' : 'I do not know enough about you yet'}</p>
        <p className="text-[13px] text-muted">
          {medium
            ? 'Two more questions would raise confidence in the ranking.'
            : 'Scores are greyed until the profile fills in. A few more answers will fix that.'}
        </p>
      </div>
      <Button
        size="sm"
        variant={medium ? 'secondary' : 'primary'}
        icon="chat"
        disabled={sending}
        onClick={() => {
          if (medium) void send('I have time for two more questions.');
          navigate(paths.interview);
        }}
      >
        {medium ? 'Answer two more' : 'Back to the interview'}
      </Button>
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading modules">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4 rounded-card border border-line bg-surface p-5">
          <Skeleton className="size-[60px] rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="mt-2 h-2 w-full max-w-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
