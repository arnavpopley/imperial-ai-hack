// The live profile (spec 14, screen 2): fills in on each profile_update as bars and chips. Every item keeps
// the student's own words behind it, revealed on hover, focus or tap. New evidence glides in and glows.
import { confidenceLabel, type Evidence, type StudentProfile } from '@modulematch/shared';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useRef, useState, type ReactNode } from 'react';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import {
  DAY_LABELS,
  DAY_NAMES,
  formatEvidenceValue,
  latestEvidence,
  percent,
  splitInterests,
  STYLE_KEYS,
  STYLE_META,
  styleValueText,
  topicLabel,
  WEEKDAYS,
} from '../labels.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';

interface ProfilePanelProps {
  profile: StudentProfile;
  evidence: readonly Evidence[];
  /** Slots to highlight, for example the ones a CV just filled. */
  highlightSlots?: ReadonlySet<string>;
  className?: string;
}

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Evidence ids present on first render are "old"; anything after that is fresh and animates. */
function useIsFresh(evidence: readonly Evidence[]): (e: Evidence | undefined) => boolean {
  const initial = useRef<ReadonlySet<string> | null>(null);
  if (initial.current === null) initial.current = new Set(evidence.map((e) => e.id));
  const seen = initial.current;
  return (e) => e !== undefined && !seen.has(e.id);
}

export function ProfilePanel({ profile, evidence, highlightSlots, className }: ProfilePanelProps) {
  const isFresh = useIsFresh(evidence);
  const { pathwayById } = useReferenceData();
  const { liked: interests, avoided } = splitInterests(profile.interests);
  const confidence = confidenceLabel(profile.completeness);
  const { avoidDays, earliestStart } = profile.timetablePrefs;
  const glow = (slot: string, ev: Evidence | undefined) => isFresh(ev) || (highlightSlots?.has(slot) ?? false);
  const avoidDaysEv = latestEvidence(evidence, 'timetablePrefs.avoidDays');
  const earliestStartEv = latestEvidence(evidence, 'timetablePrefs.earliestStart');
  const pathwaysEv = latestEvidence(evidence, 'pathways');
  const breadthEv = latestEvidence(evidence, 'breadthAppetite');

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="profile-heading" className={cx('grid min-w-0 grid-cols-1 gap-7', className)}>
        <header className="flex items-center gap-4">
          <CompletenessRing value={profile.completeness} />
          <div className="min-w-0">
            <h2 id="profile-heading" className="text-base font-semibold tracking-tight">
              Your profile
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ConfidenceBadge variant={confidence} />
            </div>
          </div>
        </header>
        <p className="-mt-3 flex items-center gap-1.5 text-[12px] text-muted">
          <Icon name="chat" size={12} className="text-brand" />
          Hover or tap an item to see your words.
        </p>

        <ProfileSection title="Drawn to">
          {interests.length === 0 ? (
            <Placeholder>Topics you enjoy appear here.</Placeholder>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              <AnimatePresence initial={false}>
                {interests.map(([topic, strength]) => {
                  const slot = `interest:${topic}`;
                  const ev = latestEvidence(evidence, slot);
                  return (
                    <motion.li
                      key={topic}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      <Quoted evidence={ev} glow={glow(slot, ev)}>
                        <span className="relative flex h-10 items-center justify-between gap-3 overflow-hidden rounded-xl bg-surface-2 px-3.5">
                          <motion.span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 rounded-xl bg-brand/12"
                            initial={false}
                            animate={{ width: `${Math.round(strength * 100)}%` }}
                            transition={{ duration: 0.7, ease: EASE }}
                          />
                          <span className="relative min-w-0 truncate text-[14px] font-medium">{topicLabel(topic)}</span>
                          <span className="relative shrink-0 text-[12px] text-muted tabular-nums">
                            {percent(strength)}
                          </span>
                        </span>
                      </Quoted>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </ProfileSection>

        {avoided.length > 0 && (
          <ProfileSection title="Avoid">
            <ul className="flex flex-wrap gap-1.5">
              {avoided.map(([topic]) => {
                const slot = `interest:${topic}`;
                const ev = latestEvidence(evidence, slot);
                return (
                  <li key={topic}>
                    <Quoted evidence={ev} glow={glow(slot, ev)}>
                      <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-muted">
                        {topicLabel(topic)}
                      </span>
                    </Quoted>
                  </li>
                );
              })}
            </ul>
          </ProfileSection>
        )}

        <ProfileSection title="How you learn">
          <ul className="grid gap-1">
            {STYLE_KEYS.map((key) => {
              const value = profile.style[key];
              const meta = STYLE_META[key];
              const slot = `style.${key}`;
              const ev = latestEvidence(evidence, slot);
              return (
                <li key={key}>
                  <Quoted evidence={ev} glow={glow(slot, ev)}>
                    <span className="grid gap-1.5 py-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium">{meta.label}</span>
                        <span className={cx('text-[12px]', value === null ? 'text-muted' : 'font-medium text-brand')}>
                          {value === null ? '–' : styleValueText(key, value)}
                        </span>
                      </span>
                      <ScaleTrack value={value} low={meta.low} high={meta.high} label={meta.label} />
                    </span>
                  </Quoted>
                </li>
              );
            })}
          </ul>
        </ProfileSection>

        <ProfileSection title="Heading towards">
          <Quoted evidence={pathwaysEv} glow={glow('pathways', pathwaysEv)}>
            {profile.pathways.length > 0 ? (
              <span className="flex flex-wrap gap-1.5">
                {profile.pathways.map((id) => (
                  <span key={id} className="rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-brand">
                    {pathwayById.get(id)?.title ?? id}
                  </span>
                ))}
              </span>
            ) : (
              <Placeholder>{profile.pathwaysSkipped ? 'Skipped for now.' : 'Career goals appear here.'}</Placeholder>
            )}
          </Quoted>
        </ProfileSection>

        <ProfileSection title="Breadth">
          <Quoted evidence={breadthEv} glow={glow('breadthAppetite', breadthEv)}>
            <span className="grid gap-1.5 py-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium">Outside your degree</span>
                <span className="text-[12px] text-muted tabular-nums">
                  {profile.breadthAppetite === null ? '–' : percent(profile.breadthAppetite)}
                </span>
              </span>
              <ScaleTrack
                value={profile.breadthAppetite}
                low="Stay focused"
                high="Explore"
                label="Appetite for breadth"
              />
            </span>
          </Quoted>
        </ProfileSection>

        <ProfileSection title="Keep free">
          <span className="grid gap-1">
            <Quoted evidence={avoidDaysEv} glow={glow('timetablePrefs.avoidDays', avoidDaysEv)}>
              <span className="sr-only">
                {avoidDays.length > 0
                  ? `Days kept free: ${avoidDays.map((d) => DAY_NAMES[d]).join(', ')}`
                  : 'No days kept free'}
              </span>
              <span className="flex gap-1.5 py-1" aria-hidden="true">
                {WEEKDAYS.map((day) => (
                  <span
                    key={day}
                    className={cx(
                      'grid h-9 flex-1 place-items-center rounded-lg text-[12px] font-medium transition-colors',
                      avoidDays.includes(day) ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {DAY_LABELS[day]}
                  </span>
                ))}
              </span>
            </Quoted>
            <Quoted evidence={earliestStartEv} glow={glow('timetablePrefs.earliestStart', earliestStartEv)}>
              <span className="flex items-center gap-1.5 py-1 text-[12px] text-muted">
                <Icon name="clock" size={12} />
                {earliestStart ? `Not before ${earliestStart}` : 'Any start time'}
              </span>
            </Quoted>
          </span>
        </ProfileSection>
      </section>
    </MotionConfig>
  );
}

/** Completeness as a ring that sweeps round as the profile fills in. */
function CompletenessRing({ value }: { value: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span
      role="meter"
      aria-label="Profile completeness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="relative grid size-14 shrink-0 place-items-center"
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" className="stroke-surface-2" />
        <motion.circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-brand"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
    </span>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="block rounded-xl border border-dashed border-line px-3.5 py-2.5 text-[13px] text-muted">
      {children}
    </span>
  );
}

/**
 * One profile item with the quote behind it. The quote drops down on hover, focus or tap, and is
 * also in the button's text for screen readers. Keyed on the evidence id so new evidence replays the glow.
 */
function Quoted({ evidence, glow, children }: { evidence: Evidence | undefined; glow: boolean; children: ReactNode }) {
  // Hover previews the quote; a click, tap or Enter pins it open until toggled again or Escape.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  if (!evidence) return <div className="-mx-2 px-2">{children}</div>;
  const extra = typeof evidence.value === 'number' ? '' : ` (${formatEvidenceValue(evidence.value)})`;
  return (
    <div
      key={evidence.id}
      className={cx('-mx-2 rounded-xl px-2', glow && 'animate-glow')}
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setPinned((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPinned(false);
        }}
        className="block w-full cursor-help rounded-xl py-0.5 text-left"
      >
        {children}
        <span className="sr-only">
          . You said: {evidence.quote}
          {extra}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            aria-hidden="true"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <span className="mt-1.5 mb-1 flex gap-2 rounded-xl bg-brand-soft/70 px-3 py-2 text-[12.5px] leading-snug">
              <Icon name="chat" size={12} className="mt-0.5 shrink-0 text-brand" />
              <span>
                <q className="italic">{evidence.quote}</q>
                {extra}
              </span>
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A two-ended scale with a marker at the student's value, or an empty track while unknown. */
function ScaleTrack({ value, low, high, label }: { value: number | null; low: string; high: string; label: string }) {
  return (
    <span className="grid gap-1">
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(value * 100)}
        aria-valuetext={value === null ? 'Not yet known' : `${percent(value)} towards ${high.toLowerCase()}`}
        className="relative block h-2 rounded-full bg-surface-2"
      >
        {value !== null && (
          <>
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-brand/25"
              initial={false}
              animate={{ width: `${value * 100}%` }}
              transition={{ duration: 0.7, ease: EASE }}
            />
            <motion.span
              className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow-soft"
              initial={false}
              animate={{ left: `calc(${value * 100}% - 7px)` }}
              transition={{ duration: 0.7, ease: EASE }}
            />
          </>
        )}
      </span>
      {value !== null && (
        <span className="flex justify-between text-[11px] text-muted" aria-hidden="true">
          <span>{low}</span>
          <span>{high}</span>
        </span>
      )}
    </span>
  );
}
