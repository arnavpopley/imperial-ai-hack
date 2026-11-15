// /demo: ModuleMatch filled in for one example student, so anyone can see what each part does without
// signing up or chatting. Every number comes from snapshot.json, which scripts/build-demo-snapshot.ts writes
// by running the real engines on a synthetic student from data/cohort.json.
import type { ClashLabel, Weekday } from '@modulematch/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/Button.tsx';
import { ClashMarker } from '../../components/ClashMarker.tsx';
import { cx } from '../../components/cx.ts';
import { FitScore } from '../../components/FitScore.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { Meter } from '../../components/Meter.tsx';
import { SubScoreBars } from '../../components/SubScoreBars.tsx';
import { EXAMPLE_STUDENT } from '../example.ts';
import { DAY_LABELS, TERM_LABELS, topicLabel, WEEKDAYS } from '../labels.ts';
import { paths } from '../routes.ts';
import snapshot from './snapshot.json';

type TabId = 'profile' | 'modules' | 'week' | 'societies';

const TABS: readonly { id: TabId; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'What she told us', icon: 'chat' },
  { id: 'modules', label: 'Her ranked modules', icon: 'grid' },
  { id: 'week', label: 'Her week', icon: 'calendar' },
  { id: 'societies', label: 'Societies', icon: 'heart' },
];

const EASE = [0.2, 0.8, 0.2, 1] as const;
const NAME = EXAMPLE_STUDENT.name;

export function DemoScreen() {
  const [tab, setTab] = useState<TabId>('profile');
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());

  // Tabs pattern: arrow keys and Home/End move between tabs and select them; only the selected tab is in the Tab order.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      event.key === 'ArrowRight' ? (i + 1) % TABS.length
      : event.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? TABS.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    const id = TABS[next]!.id;
    setTab(id);
    tabRefs.current.get(id)?.focus();
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 py-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">
            Demo
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">See it with {NAME}&rsquo;s answers</h1>
          <p className="mt-3 text-lg text-muted">
            {NAME} is a made-up Year 3 Mechanical Engineering student. Click through what ModuleMatch worked out for
            her.
          </p>
        </div>
        <Link to={paths.start} className={cx(buttonClass('primary'), 'h-12 rounded-full px-6 text-base')}>
          Try it yourself
          <Icon name="arrow-right" size={16} />
        </Link>
      </header>

      <div role="tablist" aria-label="Demo sections" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`demo-tab-${t.id}`}
              aria-selected={active}
              aria-controls="demo-panel"
              tabIndex={active ? 0 : -1}
              ref={(el) => {
                if (el) tabRefs.current.set(t.id, el);
                else tabRefs.current.delete(t.id);
              }}
              onKeyDown={onTabKey}
              onClick={() => setTab(t.id)}
              className={cx(
                'relative flex h-12 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
                active ? 'text-on-brand' : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="demo-tab"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-brand"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon name={t.icon} size={16} className="relative" />
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div id="demo-panel" role="tabpanel" tabIndex={0} aria-labelledby={`demo-tab-${tab}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {tab === 'profile' && <ProfileTab />}
            {tab === 'modules' && <ModulesTab />}
            {tab === 'week' && <WeekTab />}
            {tab === 'societies' && <SocietiesTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A panel on the left, and a short note on the right saying what the student is looking at. */
function Explained({ children, note }: { children: ReactNode; note: { title: string; points: string[] } }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 rounded-panel bg-surface p-card shadow-soft ring-1 ring-line sm:p-card-lg">{children}</div>
      <aside className="rounded-panel bg-brand-soft p-card">
        <p className="flex items-center gap-2 text-sm font-bold text-brand">
          <Icon name="info" size={16} />
          {note.title}
        </p>
        <ul className="mt-3 grid gap-3 text-sm">
          {note.points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
              {point}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

const STYLE_LABELS: Record<string, string> = {
  appliedPreference: 'Prefers applied work',
  mathsComfort: 'Comfortable with maths',
  codingComfort: 'Comfortable with code',
  workloadTolerance: 'Happy with a heavy workload',
};

function ProfileTab() {
  const interests = Object.entries(snapshot.student.interests).sort((a, b) => b[1] - a[1]);
  const style = Object.entries(STYLE_LABELS).map(([key, label]) => ({
    label,
    value: snapshot.student.style[key as keyof typeof snapshot.student.style],
  }));
  return (
    <Explained
      note={{
        title: 'What you are looking at',
        points: [
          `${NAME}'s profile: what the interview learns about a student in about three minutes.`,
          'In the app, each value links back to the sentence the student said, so nothing is guessed.',
          'Students can edit or delete any of it on the Your data page.',
        ],
      }}
    >
      <figure className="rounded-2xl bg-surface-2 p-5">
        <figcaption className="text-sm font-bold text-muted">How {NAME} might start</figcaption>
        <blockquote className="mt-2 text-lg leading-relaxed">&ldquo;{EXAMPLE_STUDENT.firstAnswer}&rdquo;</blockquote>
      </figure>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-bold text-muted">Drawn to</h2>
          <ul className="mt-4 grid gap-4">
            {interests.map(([topic, value]) => (
              <li key={topic}>
                <div className="mb-1.5 flex justify-between text-sm font-medium">
                  {topicLabel(topic)}
                  <span className="text-muted">{Math.round(value * 100)}%</span>
                </div>
                <Meter value={value} label={`Interest in ${topicLabel(topic)}`} size="md" />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold text-muted">How she likes to learn</h2>
          <ul className="mt-4 grid gap-4">
            {style.map((s) => (
              <li key={s.label}>
                <div className="mb-1.5 flex justify-between text-sm font-medium">
                  {s.label}
                  <span className="text-muted">{Math.round(s.value * 100)}%</span>
                </div>
                <Meter value={s.value} label={s.label} tone="high" size="md" />
              </li>
            ))}
          </ul>
          {snapshot.student.pathway && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium">
              <Icon name="compass" size={16} className="text-brand" />
              Heading towards: {snapshot.student.pathway.title}
            </p>
          )}
        </div>
      </div>
    </Explained>
  );
}

function ModulesTab() {
  const [open, setOpen] = useState(snapshot.topModules[0]?.id ?? null);
  const w = snapshot.weights;
  return (
    <Explained
      note={{
        title: 'What you are looking at',
        points: [
          'Every module she can take, ranked by fit out of 100. Here are her top six.',
          `Fit is worked out by plain code, not the AI: interest ${pct(w.interest)}, career goal ${pct(w.goal)}, learning style ${pct(w.style)}, breadth ${pct(w.breadth)}.`,
          'She can drag those weights and watch the order change.',
        ],
      }}
    >
      <ol className="grid gap-3">
        {snapshot.topModules.map((m, i) => {
          const expanded = open === m.id;
          return (
            <li key={m.id} className="rounded-2xl ring-1 ring-line">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : m.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-colors hover:bg-surface-2"
              >
                <span className="w-6 text-center text-sm font-bold text-muted">{i + 1}</span>
                <FitScore value={m.fit} variant="compact" className="text-base" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{m.title}</span>
                  <span className="text-sm text-muted">
                    {m.code} · {m.ects} ECTS
                  </span>
                </span>
                <Icon
                  name="chevron-down"
                  size={18}
                  className={cx('shrink-0 text-muted transition-transform', expanded && 'rotate-180')}
                />
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <SubScoreBars sub={m.sub} className="px-4 pb-5 sm:pl-14" />
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </Explained>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

const DAY_START = 9;
const DAY_END = 18;
const HOUR_PX = 40;
const MODULE_COLOURS = ['bg-module-1', 'bg-module-2', 'bg-module-3', 'bg-module-4'];
const toHours = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h + m / 60;
};

type WeekSlot = (typeof snapshot.week)[number];

/** Lay out one day's slots: any slot that overlaps another gets half the column, side by side. */
function sideBySide(daySlots: readonly WeekSlot[]): { slot: WeekSlot; column: number; columns: number }[] {
  const overlaps = (a: WeekSlot, b: WeekSlot) => toHours(a.start) < toHours(b.end) && toHours(b.start) < toHours(a.end);
  return daySlots.map((slot, i) => {
    const clashing = daySlots.filter((other, j) => j !== i && overlaps(slot, other));
    if (clashing.length === 0) return { slot, column: 0, columns: 1 };
    const group = [slot, ...clashing].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
    return { slot, column: group.indexOf(slot), columns: group.length };
  });
}

function WeekTab() {
  const colour = new Map(snapshot.shortlist.map((m, i) => [m.id, MODULE_COLOURS[i % MODULE_COLOURS.length]]));
  const titleOf = new Map(snapshot.shortlist.map((m) => [m.id, m.title]));
  const clash = snapshot.clashes[0];
  const term = clash?.term ?? 'spring';
  const slots = snapshot.week.filter((s) => s.term === term);

  return (
    <Explained
      note={{
        title: 'What you are looking at',
        points: [
          `The ${term} week for the three modules ${NAME} shortlisted.`,
          clash
            ? `${titleOf.get(clash.a)} and ${titleOf.get(clash.b)} are taught at the same time, so ModuleMatch flags a clash.`
            : 'No clashes this term.',
          'It then suggests swaps that cost her the fewest fit points.',
        ],
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{TERM_LABELS[term as keyof typeof TERM_LABELS]} term</h2>
        {clash && <ClashMarker variant={clash.label as ClashLabel} probability={clash.probability} />}
      </div>
      {/* A minimum width keeps clashing blocks readable on phones; the grid scrolls sideways instead. */}
      <div className="-mx-2 mt-5 overflow-x-auto px-2 pb-2">
        <div className="grid min-w-[38rem] grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] gap-1.5">
          <span />
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-1 text-center text-sm font-semibold text-muted">
              {DAY_LABELS[d]}
            </span>
          ))}
          <div className="relative" style={{ height: (DAY_END - DAY_START) * HOUR_PX }}>
            {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
              <span key={i} className="absolute right-1 text-xs text-muted" style={{ top: i * HOUR_PX - 6 }}>
                {DAY_START + i}:00
              </span>
            ))}
          </div>
          {WEEKDAYS.map((day: Weekday) => (
            <div key={day} className="relative rounded-xl bg-surface-2" style={{ height: (DAY_END - DAY_START) * HOUR_PX }}>
              {sideBySide(slots.filter((s) => s.day === day)).map(({ slot: s, column, columns }) => {
                  const top = (toHours(s.start) - DAY_START) * HOUR_PX;
                  const height = (toHours(s.end) - toHours(s.start)) * HOUR_PX;
                  return (
                    <div
                      key={`${s.moduleId}-${s.start}`}
                      className={cx(
                        'absolute overflow-hidden rounded-lg p-1.5 text-xs leading-tight font-semibold text-white',
                        colour.get(s.moduleId),
                        columns > 1 && 'ring-2 ring-clash-certain ring-offset-1 ring-offset-surface-2',
                      )}
                      // Overlapping slots share the column side by side, so a clash is plain to see.
                      style={{
                        top,
                        height,
                        left: `calc(${(column / columns) * 100}% + 4px)`,
                        width: `calc(${100 / columns}% - 8px)`,
                      }}
                      title={`${titleOf.get(s.moduleId)}, ${s.start} to ${s.end}`}
                    >
                      {titleOf.get(s.moduleId)}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </Explained>
  );
}

function SocietiesTab() {
  return (
    <Explained
      note={{
        title: 'What you are looking at',
        points: [
          'The same profile, matched against student societies.',
          'Each match says which of her interests it shares.',
          'In the app there is also one wildcard: a society she might not have thought of.',
        ],
      }}
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {snapshot.societies.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold">{s.name}</p>
              <FitScore value={s.fit} variant="compact" />
            </div>
            <p className="text-sm text-muted">{s.reason}</p>
          </li>
        ))}
      </ul>
    </Explained>
  );
}
