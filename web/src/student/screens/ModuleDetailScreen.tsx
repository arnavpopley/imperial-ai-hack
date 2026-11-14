// Screen 4: why a module fits, with every reason linked to the student's words or the module record.
import type { Evidence } from '@modulematch/shared';
import { Link, useParams } from 'react-router';
import { api } from '../../api.ts';
import { buttonClass } from '../../components/Button.tsx';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.tsx';
import { EvidencePopover } from '../../components/EvidencePopover.tsx';
import { FIT_BAND_LABELS, fitBand, FitScore } from '../../components/FitScore.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ModuleTypeChip } from '../../components/ModuleTypeChip.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { SubScoreBars } from '../../components/SubScoreBars.tsx';
import { reasonSource } from '../catalogue/reasonSource.ts';
import { ShortlistButton } from '../catalogue/ShortlistButton.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useShortlist } from '../hooks/useShortlist.ts';
import { TERM_LABELS } from '../labels.ts';
import { paths } from '../routes.ts';
import { useCatalogue } from '../state/CatalogueProvider.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

export function ModuleDetailScreen() {
  const { moduleId = '' } = useParams();
  const { session } = useReadySession();
  const { moduleById, pathwayById, modules } = useReferenceData();
  const { byId } = useCatalogue();
  const shortlist = useShortlist();
  const sessionId = session.id;
  const explanation = useAsync(
    () => api.explanation(sessionId, moduleId),
    [sessionId, moduleId, session.profile.updatedAt],
  );
  const module = moduleById.get(moduleId);
  const rec = byId.get(moduleId);
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

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={paths.catalogue}
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted hover:text-ink"
        >
          <Icon name="arrow-left" size={14} />
          All modules
        </Link>
        <SampleDataLabel />
      </div>

      <header className="rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {rec && <FitScore value={rec.fit} size="lg" dimmed={dimmed} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ModuleTypeChip variant={module.type} />
              {rec && <ConfidenceBadge variant={rec.confidence} />}
              {rec && (
                <span className="text-[12px] font-medium text-muted">
                  {FIT_BAND_LABELS[fitBand(rec.fit)]} · ranked #{rec.rank}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
              {module.title}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              <span className="font-mono">{module.code}</span> · {module.department} · Level {module.level} ·{' '}
              {module.ects} ECTS · {module.terms.map((t) => TERM_LABELS[t]).join(', ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <ShortlistButton
              size="md"
              title={module.title}
              shortlisted={shortlist.isShortlisted(module.id)}
              pending={shortlist.isPending(module.id)}
              onToggle={() => void shortlist.toggle(module.id)}
            />
            <a
              href={module.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-brand underline-offset-2 hover:underline"
            >
              Public description
              <Icon name="external" size={13} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
        {shortlist.error && (
          <p role="alert" className="mt-3 text-[13px] text-fit-low">
            {shortlist.error}
          </p>
        )}
        {rec && !rec.eligible && rec.ineligibleReasons.length > 0 && (
          <ul className="mt-4 grid gap-1 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
            {rec.ineligibleReasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-muted" />
                {reason}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section
          aria-labelledby="why-heading"
          className="rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft sm:p-7"
        >
          <h2 id="why-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="sparkle" size={15} className="text-brand" />
            Why this fits you
          </h2>
          {explanation.data ? (
            <>
              <p className="mt-3 text-[17px] leading-relaxed text-pretty">{explanation.data.explanation.summary}</p>
              <h3 className="mt-6 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Because</h3>
              <ul className="mt-2 grid gap-2">
                {explanation.data.explanation.because.map((reason) => {
                  const source = reasonSource(reason, evidence, module, pathwayTitle);
                  return (
                    <li
                      key={reason.text}
                      className="relative flex flex-col gap-2 rounded-xl border border-line bg-canvas px-4 py-3 sm:flex-row sm:items-start sm:gap-3"
                    >
                      {source && <EvidencePopover {...source} className="sm:order-last sm:ml-auto" />}
                      <span className="text-[15px] leading-relaxed">{reason.text}</span>
                    </li>
                  );
                })}
              </ul>
              {explanation.data.explanation.watchOuts.length > 0 && (
                <>
                  <h3 className="mt-6 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Watch out for</h3>
                  <ul className="mt-2 grid gap-2">
                    {explanation.data.explanation.watchOuts.map((w) => (
                      <li key={w} className="flex gap-2.5 rounded-xl bg-fit-mid/8 px-4 py-3 text-[15px] leading-relaxed">
                        <Icon name="info" size={16} className="mt-1 shrink-0 text-fit-mid" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-6 text-[12px] text-muted">
                Scores are computed by code from your profile. The advisor explains them and cannot change them. The
                choice is yours.
              </p>
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
              <Skeleton className="mt-4 h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <p className="text-[12px] text-muted">Writing your explanation…</p>
            </div>
          )}
        </section>

        <aside className="grid gap-5">
          {rec && (
            <section aria-labelledby="sub-heading" className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h2 id="sub-heading" className="mb-3 text-sm font-semibold">
                How the score breaks down
              </h2>
              <SubScoreBars sub={rec.sub} dimmed={dimmed} />
            </section>
          )}
          <section aria-labelledby="prereq-heading" className="rounded-card border border-line bg-surface p-5 shadow-soft">
            <h2 id="prereq-heading" className="text-sm font-semibold">
              Prerequisites
            </h2>
            {module.prerequisites.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">None.</p>
            ) : (
              <ul className="mt-2 grid gap-1.5 text-[13px]">
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
          </section>
          <section aria-labelledby="about-heading" className="rounded-card border border-line bg-surface p-5 shadow-soft">
            <h2 id="about-heading" className="text-sm font-semibold">
              About the module
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{module.description}</p>
            <h3 className="mt-4 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Learning outcomes</h3>
            {module.learningOutcomes.length > 0 ? (
              <ul className="mt-2 grid list-disc gap-1 pl-4 text-[13px] leading-relaxed">
                {module.learningOutcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted">Not listed in the public description.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
