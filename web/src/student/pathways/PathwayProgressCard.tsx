// Progress towards one pathway (spec 9.4): a headline bar, the next-best module, a collapsed per-skill
// breakdown, sample opportunities and an honest LinkedIn people search.
import type { Pathway, PathwayProgress } from '@modulematch/shared';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';
import { api } from '../../api.ts';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { ErrorState, Skeleton } from '../../components/StateViews.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { percent, skillLabel } from '../labels.ts';
import { Accordion } from '../module/Accordion.tsx';
import { paths } from '../routes.ts';
import { useModuleTitle } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { linkedInSearch } from './linkedin.ts';
import { PathwayIcon } from './PathwayIcon.tsx';
import { RevealMeter } from './RevealMeter.tsx';

interface PathwayProgressCardProps {
  pathwayId: string;
  pathway: Pathway | undefined;
  index: number;
  /** The only pathway chosen: the card fills the row, with the skill breakdown always open beside it (issue 117). */
  wide?: boolean;
}

export function PathwayProgressCard({ pathwayId, pathway, index, wide = false }: PathwayProgressCardProps) {
  const { session } = useReadySession();
  const moduleTitle = useModuleTitle();
  const reduce = useReducedMotion();
  const sessionId = session.id;
  const progress = useAsync(
    () => api.pathwayProgress(sessionId, pathwayId),
    [sessionId, pathwayId, session.shortlist.join(',')],
  );
  const title = pathway?.title ?? pathwayId;
  const linkedIn = linkedInSearch(pathwayId, title);
  const data = progress.data;
  // The skill with the largest weighted gap (importance × what is not yet covered) is the one missing most.
  const biggestGap = data?.perSkill.reduce<{ skill: string; gap: number } | null>((best, s) => {
    const gap = s.importance * (1 - s.covered);
    return !best || gap > best.gap ? { skill: s.skill, gap } : best;
  }, null)?.skill;

  return (
    <motion.article
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx(
        'rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft sm:p-6',
        wide ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8' : 'flex flex-col',
      )}
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
            <PathwayIcon pathwayId={pathwayId} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold tracking-tight">{title}</h3>
            <p className="text-[12px] text-muted">Completed, core and shortlisted modules</p>
          </div>
          {data && <span className="text-3xl font-semibold tracking-tight tabular-nums">{percent(data.progress)}</span>}
        </div>

        {data ? (
          <>
            <RevealMeter value={data.progress} label={`Progress towards ${title}`} size="lg" className="mt-4" delay={0.15} />

            {data.nextBest ? (
              <Link
                to={paths.module(data.nextBest.moduleId)}
                className="group mt-5 flex items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/50 px-4 py-3 transition hover:bg-brand-soft"
              >
                <Icon name="sparkle" size={16} className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Next best module</span>
                  <span className="block truncate text-sm font-semibold">{moduleTitle(data.nextBest.moduleId)}</span>
                  <span className="block truncate text-[12px] text-muted">
                    Adds {skillLabel(data.nextBest.skill).toLowerCase()}
                    {data.nextBest.skill === biggestGap ? ', your biggest gap' : ''}
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-brand tabular-nums">+{Math.round(data.nextBest.gain * 100)} pts</span>
                <Icon name="arrow-right" size={15} className="text-brand transition group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <p className="mt-5 flex items-center gap-2 text-[13px] text-muted">
                <Icon name="check" size={14} className="shrink-0 text-fit-high" />
                Every eligible module that suits this pathway is already in your plan.
              </p>
            )}

            {!wide && (
              <Accordion title="Skill breakdown" as="h4" meta={`${data.perSkill.length} skills`} flat className="mt-4">
                <SkillBars perSkill={data.perSkill} />
              </Accordion>
            )}
          </>
        ) : progress.error ? (
          <ErrorState className="mt-3" message={progress.error} onRetry={progress.reload} />
        ) : (
          <div className="mt-4 grid gap-2" role="status" aria-label={`Loading progress for ${title}`}>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {pathway && pathway.sampleOpportunities.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Sample opportunities">
            {pathway.sampleOpportunities.map((o) => (
              <li key={o} className="rounded-full border border-line px-2.5 py-1 text-[12px]">
                {o}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <a
            href={linkedIn.url}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-left text-[13px] font-medium transition hover:border-[#0a66c2]/60 hover:bg-surface-2"
          >
            <LinkedInMark />
            <span className="min-w-0 flex-1">{linkedIn.label}</span>
            <Icon name="external" size={14} className="shrink-0 text-muted" />
            <span className="sr-only">(opens LinkedIn in a new tab)</span>
          </a>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Opens a public LinkedIn people search. ModuleMatch cannot see your LinkedIn connections.
          </p>
        </div>
      </div>
      {wide && (
        <section aria-label={`Skills for ${title}`} className="min-w-0 lg:border-l lg:border-line lg:pl-8">
          <h4 className="mb-3 flex items-baseline justify-between text-sm font-semibold">
            What makes up {data ? percent(data.progress) : 'your progress'}
            {data && <span className="text-[12px] font-normal text-muted">{data.perSkill.length} skills</span>}
          </h4>
          {data ? (
            <SkillBars perSkill={data.perSkill} />
          ) : progress.error ? (
            <p className="text-[13px] text-muted">The skill breakdown appears once progress loads.</p>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </section>
      )}
    </motion.article>
  );
}

/** Each pathway skill's coverage, most important first, as labelled bars. */
function SkillBars({ perSkill }: { perSkill: PathwayProgress['perSkill'] }) {
  return (
    <ul className="grid gap-3">
      {[...perSkill]
        .sort((a, b) => b.importance - a.importance)
        .map((s, i) => (
          <li key={s.skill}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">{skillLabel(s.skill)}</span>
              <span className="text-[12px] text-muted tabular-nums">
                {percent(s.covered)} covered · weight {percent(s.importance)}
              </span>
            </div>
            <RevealMeter
              value={s.covered}
              label={`${skillLabel(s.skill)} covered`}
              tone={s.covered >= 0.7 ? 'high' : s.covered >= 0.4 ? 'brand' : 'mid'}
              className="mt-1"
              delay={i * 0.05}
            />
          </li>
        ))}
    </ul>
  );
}

function LinkedInMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-md bg-[#0a66c2] text-[12px] font-bold text-white"
    >
      in
    </span>
  );
}
