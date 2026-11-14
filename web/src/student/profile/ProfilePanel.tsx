// The live profile (spec 14, screen 2): fills in on each profile_update, and every item shows
// the student's own words it came from. Items backed by new evidence glide in and glow briefly.
import { confidenceLabel, type Evidence, type StudentProfile } from '@modulematch/shared';
import { useRef, type ReactNode } from 'react';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { Meter } from '../../components/Meter.tsx';
import {
  DAY_NAMES,
  formatEvidenceValue,
  latestEvidence,
  percent,
  STYLE_KEYS,
  STYLE_META,
  styleValueText,
  topicLabel,
} from '../labels.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';

interface ProfilePanelProps {
  profile: StudentProfile;
  evidence: readonly Evidence[];
  className?: string;
}

/** Evidence ids present on first render are "old"; anything after that is fresh and animates. */
function useIsFresh(evidence: readonly Evidence[]): (e: Evidence | undefined) => boolean {
  const initial = useRef<ReadonlySet<string> | null>(null);
  if (initial.current === null) initial.current = new Set(evidence.map((e) => e.id));
  const seen = initial.current;
  return (e) => e !== undefined && !seen.has(e.id);
}

export function ProfilePanel({ profile, evidence, className }: ProfilePanelProps) {
  const isFresh = useIsFresh(evidence);
  const { pathwayById } = useReferenceData();
  const interests = Object.entries(profile.interests).sort(([, a], [, b]) => b - a);
  const confidence = confidenceLabel(profile.completeness);
  const { avoidDays, earliestStart } = profile.timetablePrefs;
  const breadthEv = latestEvidence(evidence, 'breadthAppetite');
  const pathwaysEv = latestEvidence(evidence, 'pathways');
  const avoidDaysEv = latestEvidence(evidence, 'timetablePrefs.avoidDays');
  const earliestStartEv = latestEvidence(evidence, 'timetablePrefs.earliestStart');

  return (
    <section aria-labelledby="profile-heading" className={cx('grid gap-6', className)}>
      <header className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-heading" className="text-sm font-semibold tracking-tight">
            What I have heard so far
          </h2>
          <ConfidenceBadge variant={confidence} />
        </div>
        <div>
          <Meter value={profile.completeness} label="Profile completeness" size="md" />
          <p className="mt-1.5 text-[12px] text-muted">
            <span className="font-semibold text-ink tabular-nums">{percent(profile.completeness)}</span> complete. Every
            item links to your own words.
          </p>
        </div>
      </header>

      <ProfileSection title="Interests">
        {interests.length === 0 ? (
          <Placeholder>Tell me which topics you enjoy and they will appear here.</Placeholder>
        ) : (
          <ul className="grid gap-1">
            {interests.map(([topic, strength]) => {
              const ev = latestEvidence(evidence, `interest:${topic}`);
              return (
                <ProfileItem key={topic} evidence={ev} fresh={isFresh(ev)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium">{topicLabel(topic)}</span>
                    <span className="text-[12px] text-muted tabular-nums">{percent(strength)}</span>
                  </div>
                  <Meter value={strength} label={`Interest in ${topicLabel(topic)}`} className="mt-1.5" />
                </ProfileItem>
              );
            })}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection title="How you like to learn">
        <ul className="grid gap-1">
          {STYLE_KEYS.map((key) => {
            const value = profile.style[key];
            const meta = STYLE_META[key];
            const ev = latestEvidence(evidence, `style.${key}`);
            return (
              <ProfileItem key={key} evidence={ev} fresh={isFresh(ev)}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium">{meta.label}</span>
                  <span className={cx('text-[12px]', value === null ? 'text-muted italic' : 'font-medium')}>
                    {value === null ? 'Not yet known' : styleValueText(key, value)}
                  </span>
                </div>
                <ScaleTrack value={value} low={meta.low} high={meta.high} label={meta.label} />
              </ProfileItem>
            );
          })}
        </ul>
      </ProfileSection>

      <ProfileSection title="Breadth">
        <ul>
          <ProfileItem evidence={breadthEv} fresh={isFresh(breadthEv)}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">Appetite for modules outside your degree</span>
              <span className="text-[12px] text-muted tabular-nums">
                {profile.breadthAppetite === null ? 'Not yet known' : percent(profile.breadthAppetite)}
              </span>
            </div>
            <Meter
              value={profile.breadthAppetite ?? 0}
              tone={profile.breadthAppetite === null ? 'muted' : 'brand'}
              label="Appetite for breadth"
              className="mt-1.5"
            />
          </ProfileItem>
        </ul>
      </ProfileSection>

      <ProfileSection title="Career pathways">
        <ul>
          <ProfileItem evidence={pathwaysEv} fresh={isFresh(pathwaysEv)}>
            {profile.pathways.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.pathways.map((id) => (
                  <span key={id} className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-brand">
                    {pathwayById.get(id)?.title ?? id}
                  </span>
                ))}
              </div>
            ) : (
              <Placeholder>{profile.pathwaysSkipped ? 'You chose to skip pathways for now.' : 'No pathway chosen yet.'}</Placeholder>
            )}
          </ProfileItem>
        </ul>
      </ProfileSection>

      <ProfileSection title="Timetable">
        <ul className="grid gap-1">
          <ProfileItem evidence={avoidDaysEv} fresh={isFresh(avoidDaysEv)}>
            <span className="text-[13px]">
              <span className="font-medium">Keep free: </span>
              {avoidDays.length > 0 ? avoidDays.map((d) => DAY_NAMES[d]).join(', ') : <span className="text-muted">No days</span>}
            </span>
          </ProfileItem>
          <ProfileItem evidence={earliestStartEv} fresh={isFresh(earliestStartEv)}>
            <span className="text-[13px]">
              <span className="font-medium">Earliest start: </span>
              {earliestStart ?? <span className="text-muted">Any time</span>}
            </span>
          </ProfileItem>
        </ul>
      </ProfileSection>
    </section>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[13px] text-muted">{children}</p>;
}

/** One profile item with the quote that supports it. Keyed on the evidence id so new evidence replays the glow. */
function ProfileItem({ evidence, fresh, children }: { evidence: Evidence | undefined; fresh: boolean; children: ReactNode }) {
  return (
    <li key={evidence?.id ?? 'none'} className={cx('-mx-2 rounded-lg px-2 py-1.5', fresh && 'animate-glow')}>
      {children}
      {evidence && (
        <p className={cx('mt-1.5 flex gap-1.5 text-[12px] leading-snug text-muted', fresh && 'animate-rise')}>
          <Icon name="chat" size={12} className="mt-0.5 shrink-0 text-brand" />
          <span>
            <q className="italic">{evidence.quote}</q>
            {typeof evidence.value !== 'number' && (
              <span className="not-italic"> ({formatEvidenceValue(evidence.value)})</span>
            )}
          </span>
        </p>
      )}
    </li>
  );
}

/** A two-ended scale with a marker at the student's value, or an empty track while unknown. */
function ScaleTrack({ value, low, high, label }: { value: number | null; low: string; high: string; label: string }) {
  return (
    <div className="mt-1.5">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(value * 100)}
        aria-valuetext={value === null ? 'Not yet known' : `${percent(value)} towards ${high.toLowerCase()}`}
        className="relative h-1.5 rounded-full bg-surface-2"
      >
        {value !== null && (
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow-soft transition-[left] duration-700 ease-out-soft"
            style={{ left: `${value * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
