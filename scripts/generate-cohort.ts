// Generates data/cohort.json: about 200 synthetic Year 3 MEng Mechanical Engineering students across eight
// archetypes with seeded noise, each with a shortlist of 3 to 6 modules (spec 15). No real student data.
// Shortlists mimic how students choose today: anchor modules that friends in the same archetype pick (the
// popular pairs behind the deliberate clashes in generate-slots.ts), then modules by a simple interest-times-
// topic score that is discounted for modules with short, unpersuasive descriptions. That discount is what
// leaves well-fitting modules overlooked. The real scoring engine (WS2) is deliberately not used here.
// Usage: npx tsx scripts/generate-cohort.ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Module, type StudentProfile, STYLE_SLOTS, type Style, type Weekday } from '@modulematch/shared';
import {
  CohortFile,
  type CohortStudent,
  DATA_DIR,
  DATASET_FILES,
  ModulesFile,
  ProgrammeRulesFile,
  readDataset,
} from '../server/src/db/datasets.ts';
import { wordCount } from './lib/analyst.ts';
import { fraction, Rng } from './lib/prng.ts';

const SEED = 314159;
const STUDENTS_PER_ARCHETYPE = 25;
const PROGRAMME = 'MEng Mechanical Engineering';
const YEAR = 3;
const UPDATED_AT = '2026-11-01T09:00:00.000Z';
const SHORTLIST_SIZE = { min: 3, max: 6 };
/** Chance that a student shortlists each anchor module of their archetype. */
const ANCHOR_UPTAKE = 0.75;
/** Overlooked (spec 9.3): shortlisted by fewer than this share of capacity despite above-median fit. */
const OVERLOOKED_SHARE = 0.2;

interface Archetype {
  id: string;
  pathway: string;
  secondaryPathways: string[];
  interests: Record<string, number>;
  style: Record<keyof Style, number>;
  breadthAppetite: number;
  /** Modules most students of this archetype pick because their friends do. */
  anchors: [string, string];
}

const ARCHETYPES: Archetype[] = [
  {
    id: 'aerospace-motorsport',
    pathway: 'aerospace-motorsport',
    secondaryPathways: ['energy-transition', 'research-academia'],
    interests: {
      'fluid-mechanics': 0.9,
      'design-manufacturing': 0.8,
      'thermodynamics-energy': 0.7,
      'computational-simulation': 0.6,
      'solid-mechanics-materials': 0.5,
      'mathematics-modelling': 0.5,
      'experimental-lab': 0.5,
    },
    style: { examPreference: 0.45, groupPreference: 0.65, appliedPreference: 0.8, mathsComfort: 0.7, codingComfort: 0.5, workloadTolerance: 0.75 },
    breadthAppetite: 0.25,
    anchors: ['MECH60024', 'MECH60006'],
  },
  {
    id: 'energy-transition',
    pathway: 'energy-transition',
    secondaryPathways: ['consulting', 'research-academia'],
    interests: {
      'thermodynamics-energy': 0.9,
      'sustainability-climate': 0.9,
      'nuclear-energy': 0.7,
      'fluid-mechanics': 0.4,
      'policy-ethics': 0.4,
      'finance-economics': 0.3,
    },
    style: { examPreference: 0.55, groupPreference: 0.5, appliedPreference: 0.6, mathsComfort: 0.6, codingComfort: 0.3, workloadTolerance: 0.6 },
    breadthAppetite: 0.4,
    anchors: ['MECH60011', 'MECH60004'],
  },
  {
    id: 'robotics-automation',
    pathway: 'robotics-automation',
    secondaryPathways: ['software-data', 'startup-founder'],
    interests: {
      'control-robotics': 0.95,
      'electronics-embedded': 0.85,
      'programming-software': 0.75,
      'design-manufacturing': 0.5,
      'machine-learning-ai': 0.5,
    },
    style: { examPreference: 0.35, groupPreference: 0.6, appliedPreference: 0.85, mathsComfort: 0.65, codingComfort: 0.85, workloadTolerance: 0.7 },
    breadthAppetite: 0.2,
    anchors: ['MECH60018', 'MECH60009'],
  },
  {
    id: 'biomedical-devices',
    pathway: 'biomedical-devices',
    secondaryPathways: ['research-academia', 'startup-founder'],
    interests: {
      'biomedical-engineering': 0.95,
      'solid-mechanics-materials': 0.8,
      'design-manufacturing': 0.6,
      'experimental-lab': 0.6,
      'computational-simulation': 0.4,
      'psychology-behaviour': 0.2,
    },
    style: { examPreference: 0.5, groupPreference: 0.5, appliedPreference: 0.75, mathsComfort: 0.5, codingComfort: 0.35, workloadTolerance: 0.55 },
    breadthAppetite: 0.35,
    anchors: ['MECH60013', 'MECH60002'],
  },
  {
    id: 'software-data',
    pathway: 'software-data',
    secondaryPathways: ['robotics-automation', 'consulting'],
    interests: {
      'programming-software': 0.95,
      'machine-learning-ai': 0.9,
      'statistics-data': 0.85,
      'mathematics-modelling': 0.6,
      'computational-simulation': 0.5,
    },
    style: { examPreference: 0.4, groupPreference: 0.4, appliedPreference: 0.6, mathsComfort: 0.75, codingComfort: 0.95, workloadTolerance: 0.6 },
    breadthAppetite: 0.35,
    anchors: ['MECH60009', 'IEX-ML'],
  },
  {
    id: 'consulting',
    pathway: 'consulting',
    secondaryPathways: ['startup-founder', 'energy-transition'],
    interests: {
      'finance-economics': 0.85,
      'management-leadership': 0.85,
      'communication-writing': 0.6,
      'statistics-data': 0.4,
      'policy-ethics': 0.4,
      'entrepreneurship-innovation': 0.4,
    },
    style: { examPreference: 0.4, groupPreference: 0.7, appliedPreference: 0.6, mathsComfort: 0.5, codingComfort: 0.3, workloadTolerance: 0.55 },
    breadthAppetite: 0.7,
    anchors: ['BUSI60043', 'IEX-DECISIONS'],
  },
  {
    id: 'startup-founder',
    pathway: 'startup-founder',
    secondaryPathways: ['robotics-automation', 'consulting'],
    interests: {
      'entrepreneurship-innovation': 0.95,
      'design-manufacturing': 0.6,
      'management-leadership': 0.6,
      'communication-writing': 0.5,
      'programming-software': 0.4,
      'creative-arts-design': 0.4,
    },
    style: { examPreference: 0.2, groupPreference: 0.85, appliedPreference: 0.9, mathsComfort: 0.4, codingComfort: 0.5, workloadTolerance: 0.65 },
    breadthAppetite: 0.75,
    anchors: ['BUSI60041', 'IEX-INNOVATE'],
  },
  {
    id: 'research-academia',
    pathway: 'research-academia',
    secondaryPathways: ['aerospace-motorsport', 'energy-transition'],
    interests: {
      'mathematics-modelling': 0.95,
      'computational-simulation': 0.7,
      'fluid-mechanics': 0.6,
      'solid-mechanics-materials': 0.5,
      'thermodynamics-energy': 0.5,
      'statistics-data': 0.5,
      'history-philosophy': 0.4,
    },
    style: { examPreference: 0.7, groupPreference: 0.25, appliedPreference: 0.3, mathsComfort: 0.9, codingComfort: 0.6, workloadTolerance: 0.8 },
    breadthAppetite: 0.45,
    anchors: ['MECH60016', 'MECH60021'],
  },
];

/** Interest alignment I (spec 8.1) blended with the best pathway relevance: a stand-in for "how well this fits". */
function localFit(profile: StudentProfile, m: Module): number {
  const topics = Object.entries(m.topics);
  const total = topics.reduce((sum, [, t]) => sum + t, 0);
  const interest = total > 0 ? topics.reduce((sum, [j, t]) => sum + (profile.interests[j] ?? 0) * t, 0) / total : 0;
  const goal = Math.max(0, ...profile.pathways.map((c) => m.pathwayRelevance[c] ?? 0));
  return 0.6 * interest + 0.4 * goal;
}

/** How persuasive the catalogue entry looks to a student skimming it: short descriptions undersell a module. */
function visibility(m: Module): number {
  return 0.2 + 0.8 * Math.min(1, wordCount(m.description) / 100);
}

/** Spec 8.6 completeness: share of the nine required slots that are filled. */
function completeness(p: Omit<StudentProfile, 'completeness'>): number {
  const filled = [
    Object.keys(p.interests).length >= 3,
    ...STYLE_SLOTS.map((k) => p.style[k] !== null),
    p.breadthAppetite !== null,
    p.pathways.length > 0 || p.pathwaysSkipped,
  ];
  return fraction(filled.filter(Boolean).length / filled.length);
}

function makeProfile(rng: Rng, a: Archetype, index: number, completed: string[]): StudentProfile {
  const interests: Record<string, number> = {};
  for (const [topic, base] of Object.entries(a.interests)) {
    const v = fraction(base + rng.noise(0.12));
    if (v >= 0.1) interests[topic] = v;
  }
  if (rng.chance(0.3)) {
    const extra = rng.pick(Object.keys(ARCHETYPES[rng.int(0, ARCHETYPES.length - 1)]?.interests ?? {}));
    interests[extra] = Math.max(interests[extra] ?? 0, fraction(0.2 + 0.3 * rng.float()));
  }

  // At most two unanswered slots, so completeness stays between about 0.8 and 1.
  const unanswered = new Set(rng.chance(0.35) ? rng.shuffle([...STYLE_SLOTS, 'breadthAppetite'] as const).slice(0, rng.int(1, 2)) : []);
  const style = Object.fromEntries(
    STYLE_SLOTS.map((k) => [k, unanswered.has(k) ? null : fraction(a.style[k] + rng.noise(0.12))]),
  ) as Style;

  const skipped = rng.chance(0.08);
  const pathways = skipped ? [] : rng.chance(0.35) ? [a.pathway, rng.pick(a.secondaryPathways)] : [a.pathway];
  const avoidDays: Weekday[] = rng.chance(0.12) ? ['fri'] : rng.chance(0.05) ? ['mon'] : [];

  const profile = {
    studentId: `synthetic-${a.id}-${String(index + 1).padStart(2, '0')}`,
    programme: PROGRAMME,
    yearOfStudy: YEAR,
    completedModuleIds: completed,
    interests,
    pathways,
    pathwaysSkipped: skipped,
    style,
    breadthAppetite: unanswered.has('breadthAppetite') ? null : fraction(a.breadthAppetite + rng.noise(0.12)),
    timetablePrefs: { avoidDays, earliestStart: rng.chance(0.15) ? '10:00' : null },
    updatedAt: UPDATED_AT,
  } satisfies Omit<StudentProfile, 'completeness'>;
  return { ...profile, completeness: completeness(profile) };
}

/** Anchors first, then exactly one I-Explore module, then electives by perceived appeal, up to a random size. */
function makeShortlist(rng: Rng, a: Archetype, profile: StudentProfile, options: Module[]): string[] {
  const size = rng.int(SHORTLIST_SIZE.min, SHORTLIST_SIZE.max);
  const appeal = new Map(options.map((m) => [m.id, localFit(profile, m) * visibility(m) + rng.noise(0.06)]));
  const byAppeal = (list: Module[]) => [...list].sort((x, y) => (appeal.get(y.id) ?? 0) - (appeal.get(x.id) ?? 0));
  const isIExplore = (id: string) => options.find((m) => m.id === id)?.type === 'i-explore';

  const shortlist = a.anchors.filter(() => rng.chance(ANCHOR_UPTAKE));
  if (!shortlist.some(isIExplore)) {
    const best = byAppeal(options.filter((m) => m.type === 'i-explore'))[0];
    if (best) shortlist.push(best.id);
  }
  for (const m of byAppeal(options.filter((o) => o.type !== 'i-explore'))) {
    if (shortlist.length >= size) break;
    if (!shortlist.includes(m.id)) shortlist.push(m.id);
  }
  return shortlist;
}

/** Print shortlist counts against fit, the overlooked modules and the most popular pairs. */
function report(students: CohortStudent[], options: Module[]): void {
  const stats = options
    .filter((m) => m.type !== 'i-explore')
    .map((m) => ({
      m,
      fit: students.reduce((sum, s) => sum + localFit(s.profile, m), 0) / students.length,
      shortlisted: students.filter((s) => s.shortlist.includes(m.id)).length,
    }));
  const fits = stats.map((s) => s.fit).sort((x, y) => x - y);
  const median = fits[Math.floor(fits.length / 2)] ?? 0;
  const overlooked = stats.filter((s) => s.fit >= median && s.shortlisted < OVERLOOKED_SHARE * (s.m.capacity ?? Infinity));

  console.log('Electives: mean local fit, shortlisted / capacity');
  for (const s of [...stats].sort((x, y) => y.fit - x.fit)) {
    const flag = overlooked.includes(s) ? '  <- overlooked' : '';
    console.log(`  ${s.m.id.padEnd(10)} ${s.fit.toFixed(2)}  ${String(s.shortlisted).padStart(3)} / ${s.m.capacity ?? '-'}${flag}`);
  }
  if (overlooked.length === 0) throw new Error('No overlooked module: adjust the archetypes or visibility discount');

  const pairs = new Map<string, number>();
  for (const s of students) {
    const ids = [...s.shortlist].sort();
    for (const [i, x] of ids.entries()) for (const y of ids.slice(i + 1)) pairs.set(`${x} x ${y}`, (pairs.get(`${x} x ${y}`) ?? 0) + 1);
  }
  console.log('Most popular shortlisted pairs:');
  for (const [pair, n] of [...pairs].sort((x, y) => y[1] - x[1]).slice(0, 8)) console.log(`  ${String(n).padStart(3)}  ${pair}`);
}

function main(): void {
  const { modules } = readDataset(DATASET_FILES.modules, ModulesFile);
  const rules = readDataset(DATASET_FILES.programmeRules, ProgrammeRulesFile).rules.find(
    (r) => r.programme === PROGRAMME && r.year === YEAR,
  );
  if (!rules) throw new Error(`No programme rules for ${PROGRAMME} year ${YEAR}`);
  const allowed = new Set(rules.allowedElectiveIds);
  const options = modules.filter((m) => allowed.has(m.id));
  const completed = modules.filter((m) => m.level < YEAR).map((m) => m.id);

  const rng = new Rng(SEED);
  const students: CohortStudent[] = ARCHETYPES.flatMap((a) =>
    Array.from({ length: STUDENTS_PER_ARCHETYPE }, (_, i) => {
      const profile = makeProfile(rng, a, i, completed);
      return { profile, shortlist: makeShortlist(rng, a, profile, options) };
    }),
  );

  const file = CohortFile.parse({
    _note:
      'Synthetic cohort generated by scripts/generate-cohort.ts (seeded, deterministic): invented Year 3 MEng ' +
      'Mechanical Engineering students across eight archetypes with noise. No real student data of any kind.',
    students,
  });
  writeFileSync(resolve(DATA_DIR, DATASET_FILES.cohort), `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${students.length} synthetic students.`);
  report(students, options);
}

main();
