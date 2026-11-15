// Hard extraction cases (spec 18.1), chosen from the Adaption stress test (docs/adaption.md): single student turns where
// our extractor and Adaption's synthetic labels disagreed, reviewed by hand. Each case runs through the G2 and G3
// pattern passes first, as in the app, so a redaction that drops a stated interest fails here too.
// `expected` slots must match (numbers within the group's tolerance, lists as sets); `absent` slots must stay empty.
import { mergeUpdates, type ExtractedUpdate } from '../server/src/agents/extractor.ts';
import { redactByPattern } from '../server/src/guardrails/g2-redaction.ts';
import { stripInjection } from '../server/src/guardrails/g3-injection.ts';
import type { EvalResult, StudentProfile } from '@modulematch/shared';

export interface HardCase {
  name: string;
  text: string;
  /** The slots the advisor's question asked about, as the interviewer passes them. */
  targetSlots: string[];
  expected: Record<string, number | string | string[] | boolean>;
  /** Slots that must not be filled, for example a style read off a topic name. */
  absent?: string[];
  /** Why the case is hard and who was right in the stress test. */
  why: string;
}

const INTEREST = ['interest'];
const AVOID = ['interest'];
const CAREER = ['pathways'];
const ASSESSMENT = ['style.examPreference', 'style.appliedPreference'];
const TEAM = ['style.groupPreference', 'style.workloadTolerance'];
const BREADTH = ['breadthAppetite'];
const TIMETABLE = ['timetablePrefs.avoidDays', 'timetablePrefs.earliestStart'];

const SLIDERS = ['style.mathsComfort', 'style.codingComfort'];

export const HARD_CASES: HardCase[] = [
  // ---- G2 redaction must cut the disclosure, not the stated interest ----
  {
    name: 'ADHD clause, then an interest',
    text: 'I have ADHD so long lectures are tough, but I enjoy electronics.',
    targetSlots: INTEREST,
    expected: { 'interest:electronics-embedded': 0.8 },
    why: 'Seed row. The old G2 removed the whole sentence, so the interest was lost (reference right, ours wrong).',
  },
  {
    name: 'finances clause, then an interest',
    text: "I can't afford the field trip, but I'm really into sustainability.",
    targetSlots: INTEREST,
    expected: { 'interest:sustainability-climate': 0.85 },
    why: 'Seed row; same sentence-level loss as above.',
  },
  {
    name: 'interest, then a grade',
    text: 'I love CFD but I got 52% in thermodynamics.',
    targetSlots: INTEREST,
    expected: { 'interest:computational-simulation': 0.85 },
    absent: ['interest:thermodynamics-energy'],
    why: 'The grade clause goes; the CFD clause stays. Thermodynamics was only named alongside a grade.',
  },
  {
    name: 'health reasons, then an interest',
    text: 'I must limit myself to twelve credits this term due to health reasons, but I love robotics.',
    targetSlots: INTEREST,
    expected: { 'interest:control-robotics': 0.85 },
    absent: ['style.workloadTolerance'],
    why: 'Adaption row (flagged by the reviewer). "due to health reasons" was not a G2 pattern, so the disclosure reached the extractor.',
  },
  // ---- reading a preference off a topic name ----
  {
    name: 'coursework named as a topic',
    text: 'I lost track of time in the wind tunnel lab and the CFD coursework.',
    targetSlots: INTEREST,
    expected: { 'interest:fluid-mechanics': 0.85 },
    absent: ['style.examPreference', 'style.appliedPreference'],
    why: 'Seed row. Both extractors set an assessment or hands-on preference from "coursework" and "lab" (reference right).',
  },
  {
    name: 'disliking theory means applied',
    text: 'Not a fan of nuclear stuff or anything too theoretical.',
    targetSlots: AVOID,
    expected: { 'interest:nuclear-energy': 0.1, 'style.appliedPreference': 0.8 },
    why: 'Seed row. The live extractor read "theoretical" as appliedPreference 0.15, the wrong direction (reference right).',
  },
  {
    name: 'proofs are a slog',
    text: 'Anything with heavy derivations, proofs are a slog for me.',
    targetSlots: AVOID,
    expected: { 'style.mathsComfort': 0.3 },
    why: 'Seed row. The offline cues had no "slog" dislike and no maths-comfort cue.',
  },
  {
    name: 'calculus is harder',
    text: 'I find quantitative methods and advanced calculus much harder than the qualitative modules.',
    targetSlots: INTEREST,
    expected: { 'style.mathsComfort': 0.3 },
    why: 'Adaption row. Finding maths hard is low maths comfort, not a stated dislike of a topic.',
  },
  {
    name: 'slider text is not an interest',
    text: 'Maths comfort: 70%. Coding comfort: 40%',
    targetSlots: SLIDERS,
    expected: {},
    absent: ['interest:mathematics-modelling', 'interest:programming-software'],
    why: 'Found by the docs agent: the slider widget text made "Maths" an interest offline.',
  },
  {
    name: 'writing syntax is not coding',
    text: 'My syntax is usually correct, but I often fail to connect psychological concepts to my central argument clearly.',
    targetSlots: INTEREST,
    expected: {},
    absent: ['style.codingComfort'],
    why: 'Adaption row. Haiku set codingComfort 0.75 from "syntax" (ours wrong).',
  },
  // ---- timetable: only stated start times and days ----
  {
    name: 'avoid 8am lectures',
    text: 'I am most alert in the afternoons, so I avoid 8 AM lectures.',
    targetSlots: TIMETABLE,
    expected: { 'timetablePrefs.earliestStart': '09:00' },
    why: 'Adaption row. Haiku said 10:00; avoiding 8am means starting at 9 at the earliest (reference right).',
  },
  {
    name: 'study routine is not a start time',
    text: 'I dedicate two hours each morning to review and prep for the next term.',
    targetSlots: TIMETABLE,
    expected: {},
    absent: ['timetablePrefs.earliestStart'],
    why: 'Adaption row. Haiku invented a 06:00 earliest start from a study habit (ours wrong).',
  },
  {
    name: 'night owl',
    text: "I'm definitely a night owl; I do my best thinking after midnight.",
    targetSlots: TIMETABLE,
    expected: {},
    absent: ['timetablePrefs.earliestStart'],
    why: 'Adaption row. Haiku invented a 12:00 start (ours wrong). No time was asked for.',
  },
  {
    name: 'part-time job days',
    text: 'I work part-time on Tuesdays and Thursdays from noon until five.',
    targetSlots: TIMETABLE,
    expected: { 'timetablePrefs.avoidDays': ['tue', 'thu'] },
    absent: ['timetablePrefs.earliestStart'],
    why: 'Adaption row. Haiku read "until five" as a 17:00 earliest start (ours wrong).',
  },
  {
    name: 'no Friday courses',
    text: 'I cannot take any courses on Fridays due to my part-time job.',
    targetSlots: TIMETABLE,
    expected: { 'timetablePrefs.avoidDays': ['fri'] },
    why: 'Adaption row: a constraint phrased without "free" or "avoid".',
  },
  // ---- team and assessment phrasing ----
  {
    name: 'solo with a concession',
    text: "I'm more productive solo, though I can handle group work if necessary.",
    targetSlots: TEAM,
    expected: { 'style.groupPreference': 0.3 },
    absent: ['style.workloadTolerance'],
    why: 'Adaption row. The offline cues saw "group" and said 0.8; Haiku added an invented workload tolerance.',
  },
  {
    name: 'rather a portfolio than tests',
    text: "I struggle with timed tests, so I'd much rather do a portfolio.",
    targetSlots: ASSESSMENT,
    expected: { 'style.examPreference': 0.2 },
    why: 'Adaption row. The offline cues knew neither "tests" nor "portfolio".',
  },
  // ---- careers and pathways ----
  {
    name: 'torn between two careers',
    text: "I'm torn between pursuing a PhD in Sociology or entering public policy.",
    targetSlots: CAREER,
    expected: { pathways: ['research-academia'] },
    absent: ['pathwaysSkipped'],
    why: 'Adaption row. Haiku marked the pathway as skipped although a PhD was named (ours wrong).',
  },
  {
    name: 'a thesis topic is not a career',
    text: 'I am leaning towards an honors thesis focused on urban sustainability.',
    targetSlots: ASSESSMENT,
    expected: { 'interest:sustainability-climate': 0.8 },
    absent: ['pathways'],
    why: 'Adaption row. Haiku turned the thesis topic into the energy-transition pathway (ours wrong).',
  },
  // ---- mappings ----
  {
    name: 'behavioural economics',
    text: "I've always been fascinated by behavioral economics and game theory.",
    targetSlots: INTEREST,
    expected: { 'interest:finance-economics': 0.8 },
    why: 'Adaption row. Haiku left out finance-economics, the only taxonomy topic for economics (reference right).',
  },
  {
    name: 'maths modules',
    text: 'Honestly the maths modules and the statistics course were my favourite.',
    targetSlots: INTEREST,
    expected: { 'interest:mathematics-modelling': 0.85, 'interest:statistics-data': 0.85 },
    why: 'Seed row. Haiku dropped mathematics-modelling in two runs despite the prompt mapping.',
  },
];

/** The text the extractor sees after the input guardrails' pattern passes. */
export const guardedText = (text: string) => stripInjection(redactByPattern(text).text).text;

export function readSlot(profile: StudentProfile, slot: string): unknown {
  if (slot.startsWith('interest:')) return profile.interests[slot.slice('interest:'.length)] ?? null;
  if (slot.startsWith('style.')) return profile.style[slot.slice('style.'.length) as keyof StudentProfile['style']];
  if (slot === 'timetablePrefs.avoidDays') return profile.timetablePrefs.avoidDays;
  if (slot === 'timetablePrefs.earliestStart') return profile.timetablePrefs.earliestStart;
  return profile[slot as keyof StudentProfile] ?? null;
}

const isEmpty = (value: unknown) => value === null || value === false || (Array.isArray(value) && value.length === 0);
const sameSet = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Scores one case: one detail per expected and absent slot. */
export function scoreHardCase(
  c: HardCase,
  updates: ExtractedUpdate[],
  base: StudentProfile,
  tolerance: number,
): EvalResult['details'] {
  const profile = mergeUpdates(base, updates, { sessionId: 'eval', turnId: 'eval' }).profile;
  const details: EvalResult['details'] = [];
  for (const [slot, expected] of Object.entries(c.expected)) {
    const actual = readSlot(profile, slot);
    const pass =
      typeof expected === 'number'
        ? typeof actual === 'number' && Math.abs(actual - expected) <= tolerance
        : Array.isArray(expected) && Array.isArray(actual)
          ? sameSet(expected, actual)
          : JSON.stringify(actual) === JSON.stringify(expected);
    details.push({ case: `${c.name}: ${slot}`, pass, note: `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
  }
  for (const slot of c.absent ?? []) {
    const actual = readSlot(profile, slot);
    details.push({ case: `${c.name}: no ${slot}`, pass: isEmpty(actual), note: `expected nothing, got ${JSON.stringify(actual)}` });
  }
  return details;
}

