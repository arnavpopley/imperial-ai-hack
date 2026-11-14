// Generates data/slots.json: a synthetic weekly timetable for every module in data/modules.json (spec 15).
// Deterministic (seeded mulberry32). Teaching runs 09:00-18:00 and Wednesday afternoons stay free. Published
// I-Explore and BPES times are used as given; deliberate clashes are placed between elective pairs that the
// same student archetypes like; about 20% of modules are provisional with two or three candidate slots.
// Usage: npx tsx scripts/generate-slots.ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LIKELY_CLASH_THRESHOLD, type Module, type Slot, type Term, type Weekday } from '@modulematch/shared';
import {
  DATA_DIR,
  DATASET_FILES,
  ModulesFile,
  RawModulesFile,
  readDataset,
  SlotsFile,
} from '../server/src/db/datasets.ts';
import { Rng } from './lib/prng.ts';
import { clashProbability } from './lib/timetable.ts';

const SEED = 2026;
const DAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_START = 9 * 60;
const DAY_END = 18 * 60;
/** Wednesday afternoons are kept free for sport and other activities. */
const WEDNESDAY_END = 12 * 60;
/** Weekly lecture length: a one-term module has two hours a week, a module spread over two terms one hour. */
const LECTURE_MINUTES = { oneTerm: 120, twoTerms: 60 };
const TUTORIAL_MINUTES = 60;
/** Share of Year 3 and 4 modules without a listed extra session that get a weekly tutorial (Years 1 and 2 all do). */
const TUTORIAL_SHARE = 0.3;

type Kind = Slot['kind'];
interface Timing {
  day: Weekday;
  start: string;
  end: string;
}
interface FixedSession extends Timing {
  moduleId: string;
  term: Term;
  kind: Kind;
}
interface Candidate extends Timing {
  probability: number;
}

/**
 * Certain clashes between popular pairs. Each pair is liked by one student archetype in generate-cohort.ts,
 * so many students shortlist both and the pair tops the staff clash-priority list.
 */
const DELIBERATE_CLASHES: { pair: [string, string]; archetype: string; sessions: FixedSession[] }[] = [
  {
    pair: ['MECH60024', 'MECH60006'],
    archetype: 'aerospace-motorsport',
    sessions: [
      { moduleId: 'MECH60024', term: 'autumn', kind: 'lecture', day: 'mon', start: '10:00', end: '12:00' },
      { moduleId: 'MECH60006', term: 'autumn', kind: 'lecture', day: 'mon', start: '10:00', end: '11:00' },
    ],
  },
  {
    pair: ['MECH60011', 'MECH60004'],
    archetype: 'energy-transition',
    sessions: [
      { moduleId: 'MECH60011', term: 'autumn', kind: 'lecture', day: 'thu', start: '10:00', end: '11:00' },
      { moduleId: 'MECH60004', term: 'autumn', kind: 'lecture', day: 'thu', start: '10:00', end: '12:00' },
    ],
  },
  {
    pair: ['MECH60018', 'MECH60009'],
    archetype: 'robotics-automation',
    sessions: [
      { moduleId: 'MECH60018', term: 'spring', kind: 'lecture', day: 'tue', start: '14:00', end: '15:00' },
      { moduleId: 'MECH60009', term: 'spring', kind: 'lab', day: 'tue', start: '14:00', end: '17:00' },
    ],
  },
  {
    pair: ['MECH60016', 'MECH60021'],
    archetype: 'research-academia',
    sessions: [
      { moduleId: 'MECH60016', term: 'autumn', kind: 'lecture', day: 'fri', start: '09:00', end: '11:00' },
      { moduleId: 'MECH60021', term: 'autumn', kind: 'lecture', day: 'fri', start: '09:00', end: '11:00' },
    ],
  },
];

/** Other fixed sessions: Future Clean Transport Technology recommends Batteries, whose provisional slot may clash. */
const OTHER_FIXED: FixedSession[] = [
  { moduleId: 'MECH70003', term: 'spring', kind: 'lecture', day: 'thu', start: '14:00', end: '15:00' },
];

const slot = (day: Weekday, start: string, end: string, probability: number): Candidate => ({
  day,
  start,
  end,
  probability,
});

/** Provisional lectures: the room or time is not confirmed yet, so each has candidate slots summing to 1. */
const PROVISIONAL: Record<string, Candidate[]> = {
  // Year 3: candidates that may land on the deliberate clashes above.
  MECH60014: [slot('mon', '10:00', '11:00', 0.4), slot('tue', '09:00', '10:00', 0.6)],
  MECH60013: [slot('tue', '15:00', '17:00', 0.25), slot('mon', '14:00', '16:00', 0.45), slot('thu', '11:00', '13:00', 0.3)],
  MECH60007: [slot('tue', '14:00', '16:00', 0.35), slot('fri', '10:00', '12:00', 0.65)],
  MECH60019: [slot('thu', '10:00', '11:00', 0.25), slot('fri', '13:00', '14:00', 0.75)],
  MECH60002: [slot('mon', '14:00', '15:00', 0.5), slot('wed', '09:00', '10:00', 0.3), slot('fri', '15:00', '16:00', 0.2)],
  // Year 4.
  MECH70025: [slot('mon', '10:00', '12:00', 0.5), slot('thu', '14:00', '16:00', 0.5)],
  MECH70057: [slot('mon', '10:00', '12:00', 0.3), slot('tue', '11:00', '13:00', 0.7)],
  MECH70058: [slot('thu', '14:00', '16:00', 0.6), slot('fri', '09:00', '11:00', 0.4)],
  MECH70026: [slot('tue', '09:00', '11:00', 0.5), slot('wed', '10:00', '12:00', 0.5)],
  MECH70022: [slot('tue', '09:00', '11:00', 0.3), slot('thu', '09:00', '11:00', 0.4), slot('fri', '11:00', '13:00', 0.3)],
  MECH70055: [slot('wed', '09:00', '11:00', 0.5), slot('fri', '14:00', '16:00', 0.5)],
  BIOE96071: [slot('mon', '14:00', '16:00', 0.6), slot('thu', '11:00', '13:00', 0.4)],
};

/** Sessions beyond the weekly lecture, from the teaching methods on each module page. */
const EXTRA_SESSIONS: Record<string, { kind: Kind; minutes: number }[]> = {
  MECH40008: [{ kind: 'lab', minutes: 120 }],
  MECH50003: [{ kind: 'lab', minutes: 120 }],
  MECH60001: [{ kind: 'lab', minutes: 120 }],
  MECH60003: [{ kind: 'lab', minutes: 180 }],
  MECH60007: [{ kind: 'lab', minutes: 90 }],
  MECH60024: [{ kind: 'lab', minutes: 120 }],
  MECH70015: [{ kind: 'lab', minutes: 120 }],
  MECH70058: [{ kind: 'tutorial', minutes: 60 }],
};

/** Modules whose main teaching is a lab or project, so their weekly lecture is a one-hour briefing. */
const BRIEFING_ONLY = new Set(['MECH60003', 'MECH60009', 'MECH70007']);

const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Placed intervals per student year and term, so the generator avoids clashes it did not intend. */
class Occupancy {
  private readonly byGroup = new Map<string, Timing[]>();

  add(level: number, term: Term, t: Timing): void {
    const key = `${level}:${term}`;
    this.byGroup.set(key, [...(this.byGroup.get(key) ?? []), t]);
  }

  conflicts(level: number, term: Term, t: Timing): number {
    return (this.byGroup.get(`${level}:${term}`) ?? []).filter(
      (o) => o.day === t.day && o.start < t.end && t.start < o.end,
    ).length;
  }
}

/** Every allowed position for a session of the given length, in a seeded random order. */
function positions(rng: Rng, minutes: number): Timing[] {
  const out: Timing[] = [];
  for (const day of DAYS) {
    const latestEnd = day === 'wed' ? WEDNESDAY_END : DAY_END;
    for (let start = DAY_START; start + minutes <= latestEnd; start += 60) {
      out.push({ day, start: toHHMM(start), end: toHHMM(start + minutes) });
    }
  }
  return rng.shuffle(out);
}

/** The weekly sessions a module needs: a lecture, plus any listed extra session or (for some) a tutorial. */
function sessionsFor(m: Module, rng: Rng): { kind: Kind; minutes: number }[] {
  const short = BRIEFING_ONLY.has(m.id) || m.terms.length > 1;
  const lecture = { kind: 'lecture' as const, minutes: short ? LECTURE_MINUTES.twoTerms : LECTURE_MINUTES.oneTerm };
  const listed = EXTRA_SESSIONS[m.id];
  if (listed) return [lecture, ...listed];
  const tutorial = m.level <= 2 || rng.chance(TUTORIAL_SHARE);
  return tutorial ? [lecture, { kind: 'tutorial', minutes: TUTORIAL_MINUTES }] : [lecture];
}

function confirmed(moduleId: string, term: Term, kind: Kind, t: Timing): Slot {
  return { moduleId, term, kind, ...t, provisional: false, probability: 1, sessionKey: `${moduleId}:${term}:${kind}` };
}

function generate(modules: Module[], published: Map<string, Timing>): Slot[] {
  const rng = new Rng(SEED);
  const occupancy = new Occupancy();
  const levelOf = new Map(modules.map((m) => [m.id, m.level]));
  const slots: Slot[] = [];
  const done = new Set<string>();

  const place = (s: Slot) => {
    slots.push(s);
    occupancy.add(levelOf.get(s.moduleId) ?? 0, s.term, s);
    done.add(s.sessionKey);
  };

  // 1. Published times, deliberate clashes and other fixed sessions.
  for (const m of modules) {
    const t = published.get(m.id);
    if (t) for (const term of m.terms) place(confirmed(m.id, term, 'lecture', t));
  }
  for (const s of [...DELIBERATE_CLASHES.flatMap((c) => c.sessions), ...OTHER_FIXED]) {
    place(confirmed(s.moduleId, s.term, s.kind, s));
  }

  // 2. Provisional candidates, all counted as occupied so later sessions avoid them.
  for (const m of modules) {
    const candidates = PROVISIONAL[m.id];
    if (!candidates) continue;
    for (const term of m.terms) {
      for (const c of candidates) {
        place({ moduleId: m.id, term, kind: 'lecture', ...c, provisional: true, sessionKey: `${m.id}:${term}:lecture` });
      }
    }
  }

  // 3. Everything else, at the least-clashing position for that year group.
  const unplanned: string[] = [];
  for (const m of modules) {
    const sessions = published.has(m.id) ? [] : sessionsFor(m, rng);
    for (const term of m.terms) {
      for (const { kind, minutes } of sessions) {
        if (done.has(`${m.id}:${term}:${kind}`)) continue;
        let best: Timing | null = null;
        let bestConflicts = Number.POSITIVE_INFINITY;
        for (const t of positions(rng, minutes)) {
          const n = occupancy.conflicts(m.level, term, t);
          if (n < bestConflicts) [best, bestConflicts] = [t, n];
          if (n === 0) break;
        }
        if (!best) throw new Error(`No position for ${m.id} ${term} ${kind}`);
        if (bestConflicts > 0) unplanned.push(`${m.id} ${term} ${kind}`);
        place(confirmed(m.id, term, kind, best));
      }
    }
  }
  if (unplanned.length > 0) console.warn(`Sessions placed with an unplanned overlap: ${unplanned.join(', ')}`);

  return slots.sort(
    (a, b) =>
      a.moduleId.localeCompare(b.moduleId) ||
      a.sessionKey.localeCompare(b.sessionKey) ||
      DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
      a.start.localeCompare(b.start),
  );
}

/** Print the certain, likely and possible clashes between modules taken in the same year. */
function printClashSummary(modules: Module[], slots: Slot[], published: Map<string, Timing>): void {
  const slotsOf = (id: string) => slots.filter((s) => s.moduleId === id);
  const deliberate = new Set(DELIBERATE_CLASHES.map((c) => [...c.pair].sort().join('|')));
  for (const c of DELIBERATE_CLASHES) {
    const p = clashProbability(slotsOf(c.pair[0]), slotsOf(c.pair[1]));
    if (p !== 1) throw new Error(`Deliberate clash ${c.pair.join(' x ')} has P=${p}, expected 1`);
  }

  const rows: { label: string; text: string }[] = [];
  let iExplorePairs = 0;
  for (const [i, a] of modules.entries()) {
    for (const b of modules.slice(i + 1)) {
      if (a.level !== b.level) continue;
      // Students take a single I-Explore module, and all of them run at the published Thursday time.
      if (a.type === 'i-explore' && b.type === 'i-explore') {
        iExplorePairs++;
        continue;
      }
      const p = clashProbability(slotsOf(a.id), slotsOf(b.id));
      if (p === 0) continue;
      const label = p === 1 ? 'certain' : p >= LIKELY_CLASH_THRESHOLD ? 'likely' : 'possible';
      const bothPublished = published.has(a.id) && published.has(b.id);
      const why = deliberate.has([a.id, b.id].sort().join('|')) ? ' (deliberate)' : bothPublished ? ' (published times)' : '';
      rows.push({ label, text: `  ${label.padEnd(8)} P=${p.toFixed(2)}  ${a.id} ${a.title} x ${b.id} ${b.title}${why}` });
    }
  }
  console.log('Deliberate certain clashes (popular pairs):');
  for (const c of DELIBERATE_CLASHES) console.log(`  ${c.pair.join(' x ')}  liked by ${c.archetype}`);
  console.log(`(${iExplorePairs} pairs of I-Explore modules share the published Thursday slot and are not listed.)`);
  for (const label of ['certain', 'likely', 'possible']) {
    const matching = rows.filter((r) => r.label === label);
    console.log(`${label} clashes between modules in the same year: ${matching.length}`);
    for (const r of matching) console.log(r.text);
  }
}

function main(): void {
  const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
  const raw = readDataset(DATASET_FILES.rawModules, RawModulesFile);
  const published = new Map(raw.modules.flatMap((m) => (m.publishedSlot ? [[m.id, m.publishedSlot] as const] : [])));
  const slots = generate(modules, published);

  const file = SlotsFile.parse({
    _note:
      'Synthetic timetable generated by scripts/generate-slots.ts (seeded, deterministic), not a real timetable. ' +
      'I-Explore and BPES lecture times are the published ones; all other times are invented, including deliberate ' +
      'clashes between popular elective pairs and provisional slots whose candidate probabilities sum to 1.',
    slots,
  });
  writeFileSync(resolve(DATA_DIR, DATASET_FILES.slots), `${JSON.stringify(file, null, 2)}\n`);
  const provisionalModules = new Set(slots.filter((s) => s.provisional).map((s) => s.moduleId)).size;
  console.log(`Wrote ${slots.length} slots for ${modules.length} modules (${provisionalModules} provisional).`);
  printClashSummary(modules, slots, published);
}

main();
