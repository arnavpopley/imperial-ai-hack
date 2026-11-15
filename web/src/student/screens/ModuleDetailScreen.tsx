// Screen 4: a module at a glance. A hero with the fit ring, a short summary, why it fits as expandable rows,
// the record as accordions, resources, and a chat with the module knowledge agent.
import type { Evidence } from '@modulematch/shared';
import { motion, useReducedMotion } from 'motion/react';
import { Link, useParams } from 'react-router';
import { api } from '../../api.ts';
import { buttonClass } from '../../components/Button.tsx';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.tsx';
import { cx } from '../../components/cx.ts';
import { decisionsKey } from '../../components/exceptions.ts';
import { FIT_BAND_LABELS, fitBand } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ModuleTypeChip } from '../../components/ModuleTypeChip.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { SubScoreBars } from '../../components/SubScoreBars.tsx';
import { ExceptionChip } from '../catalogue/ExceptionChip.tsx';
import { reasonSource } from '../catalogue/reasonSource.ts';
import { NoScoreRing, ScoreRing } from '../catalogue/ScoreRing.tsx';
import { ShortlistButton } from '../catalogue/ShortlistButton.tsx';
import { ClaimCheck } from '../claimcheck/ClaimCheck.tsx';
import { explanationText } from '../claimcheck/claimCheck.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useShortlist } from '../hooks/useShortlist.ts';
import { TERM_LABELS } from '../labels.ts';
import { Accordion } from '../module/Accordion.tsx';
import { AiSummaryCard } from '../module/AiSummaryCard.tsx';
import { AskModulePanel } from '../module/AskModulePanel.tsx';
import { ReasonRow } from '../module/ReasonRow.tsx';
import { ResourcesSection } from '../module/ResourcesSection.tsx';
import { NudgeNote } from '../results/NudgeNote.tsx';
import { useFeedbackAffecting, useNudge } from '../results/ResultsProvider.tsx';
import { paths } from '../routes.ts';
import { useCatalogue } from '../state/CatalogueProvider.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { DemandNote } from '../catalogue/DemandChip.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function ModuleDetailScreen() {
  const { moduleId = '' } = useParams();
  const { session } = useReadySession();
  const { moduleById, pathwayById, modules, demandById } = useReferenceData();
  const { byId, scored } = useCatalogue();
  const shortlist = useShortlist();
  const reduce = useReducedMotion();
  const nudge = useNudge(moduleId);
  const relatedFeedback = useFeedbackAffecting(moduleId);
  const sessionId = session.id;
  // A Senior Tutor decision changes the module's watch-outs, so it fetches the explanation again too.
  const decisions = decisionsKey(session);
  const explanation = useAsync(
    () => api.explanation(sessionId, moduleId),
    [sessionId, moduleId, session.profile.updatedAt, decisions],
  );
  const module = moduleById.get(moduleId);
  const rec = byId.get(moduleId);
  const demand = demandById.get(moduleId);
  const pathwayTitle = (id: string) => pathwayById.get(id)?.title ?? id;

  if (modules.data && !module) {
    return (
      <EmptyState
        icon="search"
        title="Module not found"
        action={
          <Link to={paths.catalogue} className={buttonClass('secondary', 'sm')}>
            Back to your modules
          </Link>
        }
      >
        There is no module with the id “{moduleId}” in the sample catalogue.
      </EmptyState>
    );
  }
  if (!module) {
    return modules.error ? (
      <ErrorState message={modules.error} onRetry={modules.reload} />
    ) : (
      <div className="grid gap-4" role="status" aria-label="Loading module">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Quotes come back with the explanation; fall back to the session's evidence for any it omits.
  const evidence: readonly Evidence[] = [...(explanation.data?.evidence ?? []), ...session.evidence];
  const dimmed = !rec?.eligible || rec.confidence === 'low';
  /** Sections rise in one after another; reduced motion renders them in place. */
  const rise = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: EASE } };
  const facts = [
    module.code,
    module.department,
    `Level ${module.level}`,
    `${module.ects} ECTS`,
    module.terms.map((t) => TERM_LABELS[t]).join(', '),
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={paths.catalogue}
          className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted hover:text-ink"
        >
          <Icon name="arrow-left" size={14} />
          All modules
        </Link>
        <SampleDataLabel />
      </div>

      <motion.header
        {...rise(0)}
        className="relative overflow-hidden rounded-[1.5rem] border border-line bg-surface p-5 shadow-soft sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-brand-soft/70 to-transparent"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          {rec && (scored ? <ScoreRing value={rec.fit} size="lg" dimmed={dimmed} delay={0.15} /> : <NoScoreRing size="lg" />)}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ModuleTypeChip variant={module.type} />
              {rec && <ConfidenceBadge variant={rec.confidence} />}
              {rec?.exception && <ExceptionChip decision={rec.exception} />}
              {rec && scored && (
                <span className="text-2xs font-medium text-muted">
                  {FIT_BAND_LABELS[fitBand(rec.fit)]} · {rec.rank === 1 ? 'your best match' : `ranked #${rec.rank}`}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-title text-balance">
              {module.title}
            </h1>
            {/* Plain facts, not pills (issue #141): code · department · level · credits · terms. */}
            <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted" aria-label="Module facts">
              {facts.map((fact, i) => (
                <li key={`${i}-${fact}`} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <span className={cx(i === 0 && 'font-mono')}>{fact}</span>
                </li>
              ))}
            </ul>
            {demand && (
              <div className="mt-3">
                <DemandNote signal={demand} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
            <ShortlistButton
              size="lg"
              title={module.title}
              shortlisted={shortlist.isShortlisted(module.id)}
              pending={shortlist.isPending(module.id)}
              onToggle={() => void shortlist.toggle(module.id)}
              compulsory={rec?.compulsory ?? false}
            />
            <a
              href={module.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand underline-offset-2 hover:underline"
            >
              Public description
              <Icon name="external" size={13} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
        {shortlist.error && (
          <p role="alert" className="relative mt-3 text-xs text-fit-low">
            {shortlist.error}
          </p>
        )}
        {rec && !rec.eligible && rec.ineligibleReasons.length > 0 && (
          <ul className="relative mt-4 grid gap-1 rounded-xl bg-surface-2 px-4 py-3 text-xs">
            {rec.ineligibleReasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-muted" />
                {reason}
              </li>
            ))}
          </ul>
        )}
      </motion.header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="grid min-w-0 gap-6">
          {(nudge || relatedFeedback.length > 0) && (
            <motion.div {...rise(0.05)} className="grid gap-3">
              {nudge && <NudgeNote nudge={nudge} variant="page" />}
              {relatedFeedback.map((f) => (
                <Link
                  key={`${f.moduleId}-${f.examLabel}`}
                  to={paths.feedback}
                  className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-mode-explain/8 px-4 py-3 text-sm ring-1 ring-mode-explain/20 transition ring-inset hover:ring-mode-explain/40"
                >
                  <Icon name="tutor" size={16} className="shrink-0 text-mode-explain" />
                  <span className="min-w-0 flex-1">
                    Your feedback on <span className="font-medium">{moduleById.get(f.moduleId)?.title ?? f.moduleId}</span> links to
                    this module.
                  </span>
                  <span className="shrink-0 font-medium text-mode-explain group-hover:underline">See feedback</span>
                </Link>
              ))}
            </motion.div>
          )}
          <motion.div {...rise(0.08)}>
            <AiSummaryCard moduleId={module.id} />
          </motion.div>

          <motion.section
            {...rise(0.14)}
            aria-labelledby="why-heading"
            className="rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft sm:p-6"
          >
            <h2 id="why-heading" className="flex items-center gap-2 text-subheading">
              <span className="grid size-7 place-items-center rounded-full bg-fit-high/12 text-fit-high" aria-hidden="true">
                <Icon name="heart" size={14} />
              </span>
              Why it fits you
            </h2>
            {explanation.data ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-pretty">{explanation.data.explanation.summary}</p>
                {explanation.data.explanation.because.length > 0 && (
                  <ul className="mt-4 grid gap-2" aria-label="Reasons">
                    {explanation.data.explanation.because.map((reason) => (
                      <ReasonRow key={reason.text} text={reason.text} source={reasonSource(reason, evidence, module, pathwayTitle)} />
                    ))}
                  </ul>
                )}
                {explanation.data.explanation.watchOuts.length > 0 && (
                  <>
                    <h3 className="mt-5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Watch out for</h3>
                    <ul className="mt-2 grid gap-2">
                      {explanation.data.explanation.watchOuts.map((w) => (
                        <ReasonRow key={w} text={w} source={null} tone="watch-out" />
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-5 text-2xs text-muted">
                  Scores are worked out by code from your profile. The advisor explains them but cannot change them, and the
                  choice is yours.
                </p>
                <ClaimCheck
                  className="mt-3"
                  label="Check this explanation"
                  kind="fit"
                  text={explanationText(explanation.data.explanation)}
                  sourceUrl={module.sourceUrl}
                  derivedBy={module.derivedBy}
                  storageKey={`${module.id}.fit`}
                />
              </>
            ) : explanation.error ? (
              <ErrorState
                className="mt-4"
                title="The explanation did not load"
                message={explanation.error}
                onRetry={explanation.reload}
              />
            ) : (
              <div className="mt-4 grid gap-3" role="status" aria-label="Writing your explanation">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="mt-2 h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
          </motion.section>

          <motion.div {...rise(0.2)} className="grid gap-3">
            <Accordion title="About the module" icon="info" as="h2">
              <p className="text-sm leading-relaxed text-muted">{module.description}</p>
            </Accordion>
            <Accordion
              title="Learning outcomes"
              icon="check"
              as="h2"
              meta={module.learningOutcomes.length > 0 ? String(module.learningOutcomes.length) : undefined}
            >
              {module.learningOutcomes.length > 0 ? (
                <ul className="grid gap-2 text-sm leading-relaxed">
                  {module.learningOutcomes.map((o) => (
                    <li key={o} className="flex gap-2.5">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                      {o}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Not listed in the public description.</p>
              )}
            </Accordion>
            <Accordion
              title="Prerequisites"
              icon="lock"
              as="h2"
              meta={module.prerequisites.length === 0 ? 'None' : String(module.prerequisites.length)}
            >
              {module.prerequisites.length === 0 ? (
                <p className="text-xs text-muted">None listed for this module.</p>
              ) : (
                <ul className="grid gap-1.5 text-sm">
                  {module.prerequisites.map((id) => {
                    const done = session.profile.completedModuleIds.includes(id);
                    return (
                      <li key={id} className="flex items-center gap-2">
                        <Icon name={done ? 'check' : 'x'} size={14} className={done ? 'text-fit-high' : 'text-fit-low'} />
                        {moduleById.get(id)?.title ?? id}
                        <span className="sr-only">{done ? '(completed)' : '(not completed)'}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Accordion>
          </motion.div>

          <motion.div {...rise(0.26)}>
            <ResourcesSection resources={module.resources} />
          </motion.div>
        </div>

        <motion.aside {...rise(0.18)} className="grid min-w-0 gap-6 lg:sticky lg:top-20">
          <AskModulePanel sessionId={sessionId} moduleId={module.id} moduleTitle={module.title} />
          {rec && scored && (
            <section aria-labelledby="sub-heading" className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h2 id="sub-heading" className="mb-3 text-subheading">
                How the score breaks down
              </h2>
              <SubScoreBars sub={rec.sub} dimmed={dimmed} />
            </section>
          )}
        </motion.aside>
      </div>
    </div>
  );
}
