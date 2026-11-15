// Fixture responses for every route in spec section 13 (WS0).
// The web app and API route stubs use these until real engines and data land.
// Every fixture is validated against its schema in server/tests/contracts.test.ts.
import { DEFAULT_WEIGHTS } from './constants.ts';
import { combineFit } from './fit.ts';
import type {
  ClashPriority,
  Escalation,
  EvalRun,
  Evidence,
  Explanation,
  Insight,
  Module,
  Pathway,
  PathwayProgress,
  RecommendationsResponse,
  SessionState,
  Slot,
  Society,
  SocietyMatch,
  StaffEscalation,
  StaffModuleSummary,
  StudentProfile,
  TimetableView,
  TraceEvent,
} from './types.ts';

const NOW = '2026-11-14T18:00:00.000Z';
const SESSION_ID = 'fixture-session';

const baseModule = {
  department: 'Mechanical Engineering',
  level: 3,
  ects: 5,
  terms: ['autumn'],
  learningOutcomes: [],
  prerequisites: [],
  capacity: 120,
  pathwayRelevance: {},
  resources: [],
  derivedBy: 'analyst-agent',
  derivedRationale: 'Fixture module.',
} satisfies Partial<Module>;

export const fixtureModules: Module[] = [
  {
    ...baseModule,
    id: 'ME3-CFD',
    code: 'MECH70001',
    title: 'Computational Fluid Dynamics',
    type: 'elective',
    description: 'Numerical methods for fluid flow, finite volume schemes, and turbulence modelling.',
    sourceUrl: 'https://www.imperial.ac.uk/mechanical-engineering/',
    topics: { 'fluid-mechanics': 0.9, 'computational-simulation': 0.8, 'programming-software': 0.4 },
    skills: { 'modelling-simulation': 0.8, coding: 0.5 },
    pathwayRelevance: { 'energy-transition': 0.6, 'aerospace-motorsport': 0.9 },
    demand: { examShare: 0.5, groupShare: 0.2, applied: 0.7, mathsIntensity: 0.8, codingIntensity: 0.6, workload: 0.7 },
  },
  {
    ...baseModule,
    id: 'ME3-ROB',
    code: 'MECH70002',
    title: 'Robotics and Control',
    type: 'elective',
    terms: ['spring'],
    description: 'Kinematics, feedback control, and a group robot build project.',
    sourceUrl: 'https://www.imperial.ac.uk/mechanical-engineering/',
    topics: { 'control-robotics': 0.9, 'electronics-embedded': 0.5, 'programming-software': 0.5 },
    skills: { coding: 0.6, teamwork: 0.6, 'design-cad': 0.3 },
    pathwayRelevance: { 'robotics-automation': 0.95 },
    demand: { examShare: 0.3, groupShare: 0.7, applied: 0.8, mathsIntensity: 0.6, codingIntensity: 0.7, workload: 0.6 },
  },
  {
    ...baseModule,
    id: 'IEX-SUS',
    code: 'IEXP50002',
    title: 'Sustainable Futures',
    department: 'I-Explore',
    level: 2,
    type: 'i-explore',
    terms: ['autumn'],
    description: 'Explore climate solutions with students from other faculties through a group policy brief.',
    sourceUrl: 'https://www.imperial.ac.uk/i-explore/',
    topics: { 'sustainability-climate': 0.9, 'policy-ethics': 0.5, 'communication-writing': 0.3 },
    skills: { communication: 0.7, research: 0.5, teamwork: 0.5 },
    pathwayRelevance: { 'energy-transition': 0.5, consulting: 0.4 },
    demand: { examShare: 0, groupShare: 0.6, applied: 0.6, mathsIntensity: 0.1, codingIntensity: 0, workload: 0.4 },
  },
  {
    ...baseModule,
    id: 'IEX-ENT',
    code: 'IEXP50001',
    title: 'Entrepreneurship in Practice',
    department: 'I-Explore',
    level: 2,
    type: 'i-explore',
    description: 'Build and pitch a venture idea in a cross-faculty team.',
    sourceUrl: 'https://www.imperial.ac.uk/i-explore/',
    prerequisites: [],
    topics: { 'entrepreneurship-innovation': 0.9, 'finance-economics': 0.4, 'communication-writing': 0.4 },
    skills: { 'commercial-awareness': 0.8, communication: 0.7, teamwork: 0.7 },
    pathwayRelevance: { 'startup-founder': 0.9, consulting: 0.6 },
    demand: { examShare: 0, groupShare: 0.8, applied: 0.9, mathsIntensity: 0.1, codingIntensity: 0, workload: 0.5 },
  },
];

export const fixtureProfile: StudentProfile = {
  studentId: 'fixture-student',
  programme: 'MEng Mechanical Engineering',
  yearOfStudy: 3,
  completedModuleIds: [],
  interests: { 'fluid-mechanics': 0.9, 'computational-simulation': 0.7, 'entrepreneurship-innovation': 0.5 },
  pathways: ['aerospace-motorsport'],
  pathwaysSkipped: false,
  style: {
    examPreference: 0.4,
    groupPreference: 0.5,
    appliedPreference: 0.8,
    mathsComfort: 0.7,
    codingComfort: 0.6,
    workloadTolerance: 0.6,
  },
  breadthAppetite: 0.5,
  timetablePrefs: { avoidDays: ['fri'], earliestStart: '10:00' },
  completeness: 0.82,
  updatedAt: NOW,
};

export const fixtureEvidence: Evidence[] = [
  {
    id: 'ev-1',
    sessionId: SESSION_ID,
    turnId: 'turn-1',
    slot: 'interest:fluid-mechanics',
    value: 0.9,
    quote: 'I lost track of time in the wind tunnel lab',
    confidence: 0.9,
  },
  {
    id: 'ev-2',
    sessionId: SESSION_ID,
    turnId: 'turn-3',
    slot: 'style.appliedPreference',
    value: 0.8,
    quote: 'I like building things more than proofs',
    confidence: 0.8,
  },
];

export const fixtureEscalation: Escalation = {
  id: 'esc-1',
  sessionId: SESSION_ID,
  type: 'RULE_EXCEPTION',
  summary: 'The student asks to take Robotics and Control without the Year 2 control prerequisite.',
  status: 'open',
  staffResponse: null,
  createdAt: NOW,
  request: {
    moduleId: 'ME3-ROB',
    violations: [
      {
        code: 'PREREQUISITE_MISSING',
        moduleId: 'ME3-ROB',
        prerequisiteId: 'ME2-CTRL',
        message: "Robotics and Control requires ME2-CTRL, which is not among the student's completed modules.",
      },
    ],
    reason: 'I covered control theory on my placement.',
    completedModuleIds: [],
    fit: { fit: 71, sub: { interest: 0.8, goal: 0.7, style: 0.6, breadth: 0.1 } },
  },
  decision: null,
};

export const fixtureSession: SessionState = {
  id: SESSION_ID,
  mode: 'RECOMMEND',
  profile: fixtureProfile,
  evidence: fixtureEvidence,
  messages: [
    { id: 'm-1', sessionId: SESSION_ID, role: 'assistant', agent: 'interviewer', content: 'Which lectures made you lose track of time?', at: NOW },
    { id: 'm-2', sessionId: SESSION_ID, role: 'student', agent: null, content: 'I lost track of time in the wind tunnel lab.', at: NOW },
  ],
  weights: DEFAULT_WEIGHTS,
  shortlist: ['ME3-CFD', 'IEX-ENT'],
  interview: {
    depth: 'quick',
    questionsAsked: 8,
    budget: 8,
    finished: true,
    confirmed: true,
    askedSteps: ['love', 'avoid', 'career', 'assessment', 'comfort', 'team', 'breadth', 'timetable'],
    targetSlots: [],
    disputes: 0,
  },
  escalations: [fixtureEscalation],
  escalationDraft: null,
  exceptions: [],
  createdAt: NOW,
  updatedAt: NOW,
};

type FixtureRec = Omit<RecommendationsResponse['recommendations'][number], 'fit'>;
const rec = (r: FixtureRec) => ({ ...r, fit: combineFit(r.sub, DEFAULT_WEIGHTS) });
const eligible: Pick<FixtureRec, 'eligible' | 'ineligibleReasons' | 'confidence'> = {
  eligible: true,
  ineligibleReasons: [],
  confidence: 'high',
};

export const fixtureRecommendations: RecommendationsResponse = {
  weights: DEFAULT_WEIGHTS,
  confidence: 'high',
  completeness: 0.82,
  ranking: 'fit',
  coreModuleIds: [],
  recommendations: [
    rec({ moduleId: 'ME3-CFD', sub: { interest: 0.82, goal: 0.9, style: 0.86, breadth: 0.05 }, ...eligible }),
    rec({ moduleId: 'IEX-SUS', sub: { interest: 0.35, goal: 0.1, style: 0.75, breadth: 0.5 }, ...eligible }),
    rec({ moduleId: 'IEX-ENT', sub: { interest: 0.3, goal: 0, style: 0.8, breadth: 0.45 }, ...eligible }),
    rec({
      moduleId: 'ME3-ROB',
      sub: { interest: 0.1, goal: 0, style: 0.75, breadth: 0.2 },
      eligible: false,
      ineligibleReasons: ['Requires ME2-CTRL (Control Systems), which is not completed.'],
      confidence: 'high',
    }),
  ].sort((a, b) => b.fit - a.fit),
  rules: {
    programme: 'MEng Mechanical Engineering',
    year: 3,
    loaded: true,
    maxModuleLevel: 3,
    note: 'Illustrative MEng Mechanical Engineering rules for Year 3.',
  },
};

const fitOf = (moduleId: string) => fixtureRecommendations.recommendations.find((r) => r.moduleId === moduleId)?.fit ?? 0;

export const fixtureExplanation: Explanation = {
  moduleId: 'ME3-CFD',
  summary: 'A strong fit: it is mostly fluid mechanics and simulation, which you said you enjoy most.',
  because: [
    { text: 'You said you lost track of time in the wind tunnel lab.', evidenceId: 'ev-1' },
    { text: 'Fluid mechanics carries the largest topic weight in this module.', moduleField: 'topics.fluid-mechanics' },
  ],
  watchOuts: ['Maths intensity is high (0.8), slightly above the comfort you described.'],
};

const slot = (moduleId: string, day: Slot['day'], start: string, end: string, extra: Partial<Slot> = {}): Slot => ({
  moduleId,
  term: 'autumn',
  day,
  start,
  end,
  kind: 'lecture',
  provisional: false,
  probability: 1,
  sessionKey: `${moduleId}-${day}-${start}`,
  ...extra,
});

export const fixtureSlots: Slot[] = [
  slot('ME3-CFD', 'tue', '10:00', '12:00'),
  slot('IEX-ENT', 'tue', '11:00', '13:00'),
  slot('ME3-ROB', 'wed', '14:00', '16:00', { term: 'spring' }),
  slot('IEX-SUS', 'thu', '14:00', '16:00'),
];

export const fixtureTimetable: TimetableView = {
  grids: [
    { term: 'autumn', slots: fixtureSlots.filter((s) => s.term === 'autumn') },
    { term: 'spring', slots: [] },
  ],
  clashes: [
    {
      moduleA: 'ME3-CFD',
      moduleB: 'IEX-ENT',
      term: 'autumn',
      probability: 1,
      label: 'certain',
      overlaps: [{ a: fixtureSlots[0]!, b: fixtureSlots[1]! }],
    },
  ],
  // IEX-SUS is eligible, clashes with nothing on the shortlist and is within the 10-point tolerance (spec 9.2).
  swaps: [
    {
      replaceModuleId: 'IEX-ENT',
      withModuleId: 'IEX-SUS',
      fit: fitOf('IEX-SUS'),
      fitDelta: fitOf('IEX-SUS') - fitOf('IEX-ENT'),
      keepFreeConflicts: 0,
    },
  ],
  // The clash above has a swap within the fit window, so there is nothing beyond it to offer.
  widerSwaps: [],
  backups: [],
  // fixtureProfile keeps Fridays free and starts no earlier than 10:00; nothing on the shortlist falls in that time.
  coreModuleIds: [],
  keepFree: [
    ...(['mon', 'tue', 'wed', 'thu'] as const).map((day) => ({ day, from: '00:00', to: '10:00', reason: 'early' as const })),
    { day: 'fri', from: '00:00', to: '23:59', reason: 'day' },
  ],
  keepFreeConflicts: [],
  ects: { core: 0, elective: 5, iExplore: 5, max: 60 },
  rules: { ok: true, violations: [], warnings: [] },
};

export const fixturePathways: Pathway[] = [
  {
    id: 'aerospace-motorsport',
    title: 'Aerospace and motorsport',
    description: 'Aerodynamics, performance, and simulation-heavy engineering roles.',
    skills: { 'modelling-simulation': 0.9, 'quantitative-analysis': 0.8, coding: 0.5, teamwork: 0.4 },
    sampleOpportunities: ['Formula Student team', 'Aerodynamics summer placement'],
  },
];

export const fixturePathwayProgress: PathwayProgress = {
  pathwayId: 'aerospace-motorsport',
  progress: 0.46,
  perSkill: [
    { skill: 'modelling-simulation', importance: 0.9, covered: 0.8 },
    { skill: 'quantitative-analysis', importance: 0.8, covered: 0.3 },
  ],
  nextBest: { moduleId: 'ME3-CFD', gain: 0.12, skill: 'modelling-simulation' },
};

export const fixtureSocieties: Society[] = [
  {
    id: 'soc-racing',
    name: 'Imperial Racing Green',
    description: 'Student team designing and racing an electric vehicle.',
    topics: { 'design-manufacturing': 0.8, 'electronics-embedded': 0.6 },
    sourceUrl: 'https://www.imperialcollegeunion.org/',
  },
];

export const fixtureSocietyMatches: SocietyMatch[] = [
  { societyId: 'soc-racing', fit: 72, wildcard: false, reason: 'Matches your interest in applied design work.' },
];

export const fixtureStaffModules: StaffModuleSummary[] = fixtureModules.map((m, i) => ({
  moduleId: m.id,
  code: m.code,
  title: m.title,
  type: m.type,
  capacity: m.capacity,
  shortlisted: [64, 12, 9, 31][i] ?? 0,
  averageFit: [71, 58, 44, 49][i] ?? 0,
  fitHistogram: [0, 1, 4, 9, 18, 30, 42, 50, 32, 14],
  cohortSize: 200,
}));

export const fixtureInsights: Insight[] = [
  {
    id: 'ins-1',
    moduleId: 'ME3-ROB',
    kind: 'COUNTERFACTUAL',
    headline: 'Ease the coding from demanding to moderate: would move the module into the top five for 12 of the 38 interested students',
    detail: '38 students are interested in the topics of MECH70002 Robotics and Control, but its fit for them is below 75. With this change their average fit rises by 6.0 points: 12 more of them would newly have it in their top five eligible modules (9 already do), and 15 would rise to fit 70 or more.',
    cohortSize: 38,
    upliftPoints: 6,
    decision: 'pending',
  },
];

export const fixtureClashPriorities: ClashPriority[] = [
  { moduleA: 'ME3-CFD', moduleB: 'IEX-ENT', students: 23, probability: 1, priority: 23 },
];

export const fixtureStaffEscalations: StaffEscalation[] = [
  {
    ...fixtureEscalation,
    studentContext: { programme: fixtureProfile.programme, yearOfStudy: 3, shortlist: fixtureSession.shortlist },
  },
];

export const fixtureTrace: TraceEvent[] = [
  { id: 't-1', sessionId: SESSION_ID, at: NOW, actor: 'supervisor', kind: 'mode', input: 'INTERVIEW', output: 'RECOMMEND', verdict: null, latencyMs: 0 },
  { id: 't-2', sessionId: SESSION_ID, at: NOW, actor: 'G2 redaction', kind: 'guardrail', input: 'student turn (84 chars)', output: 'no sensitive data', verdict: 'pass', latencyMs: 210 },
];

export const fixtureEvalRun: EvalRun = {
  id: 'eval-fixture',
  at: NOW,
  results: [
    { name: 'Determinism', passed: 1, total: 1, target: 1, details: [{ case: 'same profile twice', pass: true }] },
  ],
};
