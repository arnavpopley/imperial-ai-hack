// Spec 20.3 as a page of its own: what we know about the student, the words it came from, an edit form and
// a "Delete everything" danger zone. Interests, goals and preferences, plus marks only when the student shares them
// with consent (spec 23); never health or background.
import { confidenceLabel, type Evidence, type StudentProfile } from '@modulematch/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api.ts';
import { Button } from '../../components/Button.tsx';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.tsx';
import { GlanceStats, PageHeader } from '../../components/PageHeader.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import {
  formatEvidenceValue,
  percent,
  slotLabel,
  STYLE_KEYS,
  STYLE_META,
  styleValueText,
  topicLabel,
} from '../labels.ts';
import { clearRevisionChecklists } from '../feedback/plan.ts';
import { KeepFreeDays } from '../profile/KeepFreeDays.tsx';
import { ProfileEditor } from '../profile/ProfileEditor.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { errorStatus } from '../results/files.ts';
import { ResultsDataSection } from '../results/ResultsDataSection.tsx';
import { useResults } from '../results/ResultsProvider.tsx';
import { offersResultsStep } from '../results/resultsStep.ts';
import { paths } from '../routes.ts';
import { useModuleTitle, useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { downloadFile } from '../download.ts';
import { DELETED_STATE } from './paths.ts';

const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
} as const;

export function YourDataPage() {
  const { session } = useReadySession();
  const { profile, evidence } = session;
  const [editing, setEditing] = useState(false);

  return (
    <div className="grid gap-section">
      <Hero profile={profile} quoteCount={evidence.length} />

      <section aria-labelledby="known-heading" className="grid gap-6">
        <SectionHeading id="known-heading" eyebrow="What we know" title="Your profile, as the matcher sees it">
          Each card shows the words it came from. Nothing else is used to rank modules.
        </SectionHeading>
        <div className="grid gap-5 md:grid-cols-2">
          <InterestsCard profile={profile} evidence={evidence} />
          <StyleCard profile={profile} evidence={evidence} />
          <PathwaysCard profile={profile} evidence={evidence} />
          <TimetableCard profile={profile} evidence={evidence} />
        </div>
      </section>

      <section aria-labelledby="edit-heading" className="grid gap-6">
        <SectionHeading id="edit-heading" eyebrow="Edit" title="Correct anything we got wrong">
          Changes re-rank your catalogue straight away.
        </SectionHeading>
        <EditSection editing={editing} onEditingChange={setEditing} />
      </section>

      <ResultsSection />

      <DownloadData />
      <DangerZone />
    </div>
  );
}

/**
 * Issue 63 and spec 20.3: see, edit, delete, and take a copy. The JSON is built from what this page already holds
 * (profile, the quotes behind it, shortlist and escalations) and saved by the browser; nothing is sent anywhere.
 */
function DownloadData() {
  const { session } = useReadySession();
  const download = () => {
    const copy = {
      exportedAt: new Date().toISOString(),
      note: 'Your ModuleMatch data, saved from your own browser. Timetable times are provisional, based on previous years.',
      profile: session.profile,
      evidence: session.evidence.map(({ slot, value, quote, confidence }) => ({ slot, value, quote, confidence })),
      shortlist: session.shortlist,
      escalations: session.escalations,
    };
    downloadFile('modulematch-my-data.json', 'application/json', `${JSON.stringify(copy, null, 2)}\n`);
  };
  return (
    <section aria-labelledby="download-heading" className="flex flex-wrap items-center gap-4 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Icon name="arrow-down" size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="download-heading" className="text-heading">
          Download my data
        </h2>
        <p className="text-sm text-muted">Profile, your quotes, shortlist and tutor requests, as a JSON file on your device.</p>
      </div>
      <Button icon="arrow-down" onClick={download}>
        Download JSON
      </Button>
    </section>
  );
}

/**
 * Marks the student shared (spec 23). Year 1 has no university marks and is never asked for any, so with nothing
 * stored it gets a short note instead of an empty card.
 */
function ResultsSection() {
  const { session } = useReadySession();
  const { results, hasResults } = useResults();
  // Only once the read has settled as empty (a 404 means the route is off, which is empty too): while it loads, or
  // when it fails, the card shows its skeleton or its error instead of a note that would hide the problem.
  const settledEmpty =
    !hasResults && !results.loading && (results.error === null ? results.data !== undefined : errorStatus(results.error) === 404);
  const canShare = offersResultsStep(session.profile.yearOfStudy);
  const nothingToShare = !canShare && settledEmpty;
  return (
    <section aria-labelledby="results-heading" className="grid min-w-0 grid-cols-1 gap-6">
      {nothingToShare ? (
        <SectionHeading id="results-heading" eyebrow="Results" title="Your results">
          From Year 2 you can choose to share your university marks here. Nothing is asked for in Year 1.
        </SectionHeading>
      ) : (
        <>
          <SectionHeading id="results-heading" eyebrow="Results" title="Marks you chose to share">
            Visible only to you. They never change your fit scores.
          </SectionHeading>
          <ResultsDataSection canAdd={canShare} />
        </>
      )}
    </section>
  );
}

/** The page header, then the facts the profile starts from. Completeness sits in the glance slot. */
function Hero({ profile, quoteCount }: { profile: StudentProfile; quoteCount: number }) {
  const moduleTitle = useModuleTitle();
  const completed = profile.completedModuleIds;
  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 font-medium text-brand">
            <Icon name="lock" size={14} /> Private to you
          </span>
        }
        title="Your data"
        subtitle="Your interests, goals and preferences, and marks only if you choose to share them. Never health or background."
        glance={
          <GlanceStats
            label="Your profile at a glance"
            items={[
              { label: 'complete', value: percent(profile.completeness) },
              { label: quoteCount === 1 ? 'quote kept' : 'quotes kept', value: quoteCount },
            ]}
          >
            <ConfidenceBadge variant={confidenceLabel(profile.completeness)} />
          </GlanceStats>
        }
      />
      <motion.ul {...rise} className="flex flex-wrap gap-2 text-sm" aria-label="Your programme">
        <Fact icon="tutor">{profile.programme}</Fact>
        <Fact icon="calendar">Year {profile.yearOfStudy}</Fact>
        <Fact icon="check">
          {completed.length > 0 ? `${completed.length} completed: ${completed.map(moduleTitle).join(', ')}` : 'No completed modules listed'}
        </Fact>
      </motion.ul>
    </div>
  );
}

function Fact({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="inline-flex max-w-full items-center gap-2 rounded-full bg-surface-2 px-3.5 py-1.5 text-ink">
      <Icon name={icon} size={15} className="shrink-0 text-muted" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function SectionHeading({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">{eyebrow}</p>
      <h2 id={id} className="text-heading">
        {title}
      </h2>
      {children && <p className="max-w-2xl text-sm text-muted">{children}</p>}
    </div>
  );
}

function DataCard({
  icon,
  title,
  tint,
  quotes,
  children,
}: {
  icon: IconName;
  title: string;
  tint: string;
  quotes: readonly Evidence[];
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <motion.article
      {...rise}
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg"
    >
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className={cx('grid size-11 place-items-center rounded-2xl', tint)}>
          <Icon name={icon} size={22} />
        </span>
        <h3 id={headingId} className="text-lg font-semibold tracking-tight">
          {title}
        </h3>
      </header>
      <div className="flex-1">{children}</div>
      <Quotes quotes={quotes} />
    </motion.article>
  );
}

/** The student's own words behind a card, collapsed to the first two. */
function Quotes({ quotes }: { quotes: readonly Evidence[] }) {
  const [all, setAll] = useState(false);
  if (quotes.length === 0)
    return <p className="border-t border-line pt-4 text-sm text-muted">No quote yet: this came from a default or an edit.</p>;
  const shown = all ? quotes : quotes.slice(0, 2);
  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">In your words</p>
      <ul className="grid gap-2.5">
        {shown.map((e) => (
          <li key={e.id} className="rounded-2xl bg-surface-2 px-4 py-3">
            <q className="text-sm leading-relaxed text-ink">{e.quote}</q>
            <p className="mt-1 text-xs text-muted">
              {slotLabel(e.slot)}: {formatEvidenceValue(e.value)}
            </p>
          </li>
        ))}
      </ul>
      {quotes.length > 2 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="justify-self-start rounded-lg text-sm font-medium text-brand hover:underline"
        >
          {all ? 'Show fewer' : `Show all ${quotes.length} quotes`}
        </button>
      )}
    </div>
  );
}

const quotesFor = (evidence: readonly Evidence[], test: (slot: string) => boolean) =>
  evidence.filter((e) => test(e.slot)).toReversed();

function InterestsCard({ profile, evidence }: { profile: StudentProfile; evidence: readonly Evidence[] }) {
  const interests = Object.entries(profile.interests).sort((a, b) => b[1] - a[1]);
  return (
    <DataCard
      icon="heart"
      title="Interests"
      tint="bg-art-6/10 text-art-6"
      quotes={quotesFor(evidence, (s) => s.startsWith('interest:'))}
    >
      {interests.length === 0 ? (
        <p className="text-sm text-muted">No interests yet. Tell the interviewer what you enjoy.</p>
      ) : (
        <ul className="grid gap-3.5">
          {interests.map(([topic, weight], i) => (
            <li key={topic} className="grid gap-1.5">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{topicLabel(topic)}</span>
                <span className="text-muted tabular-nums">{percent(weight)}</span>
              </span>
              <Bar value={weight} delay={i * 0.06} label={`Interest in ${topicLabel(topic)}`} />
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  );
}

function Bar({ value, delay, label }: { value: number; delay: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2.5 overflow-hidden rounded-full bg-surface-2"
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-brand to-mode-explain"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

function StyleCard({ profile, evidence }: { profile: StudentProfile; evidence: readonly Evidence[] }) {
  const known = STYLE_KEYS.filter((k) => profile.style[k] !== null);
  return (
    <DataCard
      icon="sliders"
      title="How you like to learn"
      tint="bg-mode-explain/10 text-mode-explain"
      quotes={quotesFor(evidence, (s) => s.startsWith('style.') || s === 'breadthAppetite')}
    >
      {known.length === 0 && profile.breadthAppetite === null ? (
        <p className="text-sm text-muted">Nothing yet. The interview asks about exams, teamwork and workload.</p>
      ) : (
        <ul className="grid gap-4">
          {known.map((key) => {
            const value = profile.style[key] ?? 0.5;
            const meta = STYLE_META[key];
            return (
              <li key={key} className="grid gap-1.5">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-muted">{styleValueText(key, value)}</span>
                </span>
                <Scale value={value} low={meta.low} high={meta.high} label={meta.label} />
              </li>
            );
          })}
          {profile.breadthAppetite !== null && (
            <li className="grid gap-1.5">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">Appetite for breadth</span>
                <span className="text-muted tabular-nums">{percent(profile.breadthAppetite)}</span>
              </span>
              <Scale value={profile.breadthAppetite} low="Focused" high="Broad" label="Appetite for breadth" />
            </li>
          )}
        </ul>
      )}
    </DataCard>
  );
}

/** A two-ended scale with a dot where the student sits. */
function Scale({ value, low, high, label }: { value: number; low: string; high: string; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% towards ${high.toLowerCase()}`}
        className="relative h-2.5 rounded-full bg-surface-2"
      >
        <motion.span
          aria-hidden="true"
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mode-explain ring-4 ring-surface"
          initial={{ left: '50%' }}
          animate={{ left: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function PathwaysCard({ profile, evidence }: { profile: StudentProfile; evidence: readonly Evidence[] }) {
  const { pathwayById } = useReferenceData();
  return (
    <DataCard
      icon="compass"
      title="Career pathways"
      tint="bg-mode-plan/10 text-mode-plan"
      quotes={quotesFor(evidence, (s) => s === 'pathways' || s === 'pathwaysSkipped')}
    >
      {profile.pathways.length === 0 ? (
        <p className="text-sm text-muted">
          {profile.pathwaysSkipped ? 'You chose to skip pathways for now.' : 'No pathway chosen yet.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2.5">
          {profile.pathways.map((id) => (
            <li key={id} className="inline-flex items-center gap-2 rounded-full bg-mode-plan/10 px-4 py-2 text-sm font-medium text-mode-plan">
              <Icon name="compass" size={15} />
              {pathwayById.get(id)?.title ?? id}
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  );
}

function TimetableCard({ profile, evidence }: { profile: StudentProfile; evidence: readonly Evidence[] }) {
  const { avoidDays, earliestStart, avoidHalfDays = [] } = profile.timetablePrefs;
  return (
    <DataCard
      icon="calendar"
      title="Timetable preferences"
      tint="bg-art-2/10 text-art-2"
      quotes={quotesFor(evidence, (s) => s.startsWith('timetablePrefs.'))}
    >
      <div className="grid gap-5">
        <div>
          <p className="mb-2.5 text-sm font-medium">Days to keep free</p>
          <KeepFreeDays avoidDays={avoidDays} avoidHalfDays={avoidHalfDays} />
        </div>
        <p className="flex items-center gap-2 text-sm">
          <Icon name="clock" size={16} className="text-muted" />
          {earliestStart ? (
            <span>
              Nothing before <span className="font-semibold tabular-nums">{earliestStart}</span>
            </span>
          ) : (
            <span className="text-muted">No earliest start time</span>
          )}
        </p>
      </div>
    </DataCard>
  );
}

function EditSection({ editing, onEditingChange }: { editing: boolean; onEditingChange: (v: boolean) => void }) {
  const { session } = useReadySession();
  const { save, saving, error } = useProfileActions();
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg">
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="editor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ProfileEditor
              profile={session.profile}
              saving={saving}
              error={error}
              onCancel={() => onEditingChange(false)}
              onSave={(body) => {
                void save(body).then((ok) => {
                  if (ok) {
                    setSaved(true);
                    onEditingChange(false);
                  }
                });
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="grid gap-1">
              <p className="font-medium">Interests, learning style and timetable preferences</p>
              <p className="text-sm text-muted">
                {saved ? 'Saved. Your catalogue is re-ranked.' : 'Adjust a slider, add a topic or free up a day.'}
              </p>
            </div>
            <Button variant="primary" icon="edit" onClick={() => onEditingChange(true)}>
              Edit my profile
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DangerZone() {
  const { session, forget } = useReadySession();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteProfile(session.id);
      clearRevisionChecklists(session.id);
      navigate(paths.start, { state: DELETED_STATE });
      forget();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <section
      aria-labelledby="danger-heading"
      className="grid gap-4 rounded-panel border-2 border-dashed border-fit-low/40 bg-fit-low/5 p-card sm:p-card-lg"
    >
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-fit-low/15 text-fit-low">
          <Icon name="trash" size={22} />
        </span>
        <div className="grid gap-1">
          <h2 id="danger-heading" className="text-heading">
            Delete everything
          </h2>
          <p className="text-sm text-muted">
            Removes your profile, every quote above and any marks you shared, then starts over. This cannot be undone.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-fit-low">
          {error}
        </p>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div
            key="confirm"
            role="group"
            aria-label="Confirm deletion"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-fit-low/30"
          >
            <span className="font-medium">Delete everything we hold about you?</span>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button variant="danger" icon="trash" busy={deleting} onClick={() => void remove()}>
                Yes, delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                Keep my data
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>
              Delete everything
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
