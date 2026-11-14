// Zod schemas for every contract in MODULE_MATCHER_SPEC.md sections 7, 9 and 13.
// Types are inferred from these schemas in ./types.ts, so each contract is defined once.
import { z } from 'zod';

// ---------- primitives ----------

export const Fraction = z.number().min(0).max(1);
export const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
export const IsoDate = z.string();

export const TopicId = z.string().min(1);
export const SkillId = z.string().min(1);
export const PathwayId = z.string().min(1);
export const Term = z.enum(['autumn', 'spring', 'summer']);
export const Weekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri']);
export const Mode = z.enum(['ONBOARD', 'INTERVIEW', 'RECOMMEND', 'EXPLAIN', 'PLAN', 'ESCALATED']);
export const YearOfStudy = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const weightMap = <K extends z.ZodString>(key: K) => z.record(key, Fraction);

// ---------- section 7: data model ----------

export const StyleDimensions = ['examPreference', 'groupPreference', 'appliedPreference'] as const;
export const CapabilityDimensions = ['mathsComfort', 'codingComfort', 'workloadTolerance'] as const;

export const Style = z.object({
  examPreference: Fraction.nullable(),
  groupPreference: Fraction.nullable(),
  appliedPreference: Fraction.nullable(),
  mathsComfort: Fraction.nullable(),
  codingComfort: Fraction.nullable(),
  workloadTolerance: Fraction.nullable(),
});

export const StudentProfile = z.object({
  studentId: z.string(),
  programme: z.string(),
  yearOfStudy: YearOfStudy,
  completedModuleIds: z.array(z.string()),
  interests: weightMap(TopicId),
  pathways: z.array(PathwayId).max(3),
  /** True once the student has explicitly skipped choosing a pathway (counts towards completeness). */
  pathwaysSkipped: z.boolean(),
  style: Style,
  breadthAppetite: Fraction.nullable(),
  timetablePrefs: z.object({ avoidDays: z.array(Weekday), earliestStart: HHMM.nullable() }),
  completeness: Fraction,
  updatedAt: IsoDate,
});

export const Evidence = z.object({
  id: z.string(),
  sessionId: z.string(),
  turnId: z.string(),
  slot: z.string(),
  value: z.union([z.number(), z.string()]),
  quote: z.string().max(200),
  confidence: Fraction,
});

export const ModuleDemand = z.object({
  examShare: Fraction,
  groupShare: Fraction,
  applied: Fraction,
  mathsIntensity: Fraction,
  codingIntensity: Fraction,
  workload: Fraction,
});

/** Fields derived by the Module Analyst agent and editable by staff. */
export const ModuleDerived = z.object({
  topics: weightMap(TopicId),
  skills: weightMap(SkillId),
  pathwayRelevance: weightMap(PathwayId),
  demand: ModuleDemand,
  derivedBy: z.enum(['analyst-agent', 'staff-edit']),
  derivedRationale: z.string(),
});

export const Module = z
  .object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    department: z.string(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    ects: z.number().positive(),
    type: z.enum(['core', 'elective', 'i-explore']),
    terms: z.array(Term).min(1),
    description: z.string(),
    learningOutcomes: z.array(z.string()),
    sourceUrl: z.string().url(),
    prerequisites: z.array(z.string()),
    capacity: z.number().int().positive().nullable(),
  })
  .extend(ModuleDerived.shape);

export const Slot = z.object({
  moduleId: z.string(),
  term: Term,
  day: Weekday,
  start: HHMM,
  end: HHMM,
  kind: z.enum(['lecture', 'tutorial', 'lab']),
  provisional: z.boolean(),
  probability: Fraction,
  sessionKey: z.string(),
});

export const Weights = z.object({
  interest: z.number().min(0),
  goal: z.number().min(0),
  style: z.number().min(0),
  breadth: z.number().min(0),
});

export const Confidence = z.enum(['high', 'medium', 'low']);

export const Recommendation = z.object({
  moduleId: z.string(),
  fit: z.number().int().min(0).max(100),
  sub: z.object({
    interest: Fraction,
    goal: Fraction.nullable(),
    style: Fraction,
    breadth: Fraction,
  }),
  eligible: z.boolean(),
  ineligibleReasons: z.array(z.string()),
  confidence: Confidence,
});

export const ExplanationReason = z.object({
  text: z.string(),
  evidenceId: z.string().optional(),
  moduleField: z.string().optional(),
});

export const Explanation = z.object({
  moduleId: z.string(),
  summary: z.string(),
  because: z.array(ExplanationReason),
  watchOuts: z.array(z.string()),
});

export const EscalationType = z.enum(['RULE_EXCEPTION', 'LOW_CONFIDENCE', 'WELLBEING', 'COMPLAINT']);
export const EscalationStatus = z.enum(['open', 'claimed', 'resolved']);

export const Escalation = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: EscalationType,
  summary: z.string(),
  status: EscalationStatus,
  staffResponse: z.string().nullable(),
  createdAt: IsoDate,
});

export const InsightKind = z.enum(['COUNTERFACTUAL', 'OVERLOOKED', 'DEMAND', 'CLASH']);
export const InsightDecision = z.enum(['pending', 'accepted', 'noted', 'dismissed']);

export const Insight = z.object({
  id: z.string(),
  moduleId: z.string(),
  kind: InsightKind,
  headline: z.string(),
  detail: z.string(),
  cohortSize: z.number().int().min(0),
  upliftPoints: z.number().nullable(),
  decision: InsightDecision,
});

export const TraceKind = z.enum(['mode', 'agent', 'tool', 'guardrail', 'escalation']);
export const Verdict = z.enum(['pass', 'block', 'redact', 'escalate']);

export const TraceEvent = z.object({
  id: z.string(),
  sessionId: z.string(),
  at: IsoDate,
  actor: z.string(),
  kind: TraceKind,
  input: z.string(),
  output: z.string(),
  verdict: Verdict.nullable(),
  latencyMs: z.number().min(0),
});

// ---------- section 9: engine contracts ----------

export const ProgrammeRules = z.object({
  programme: z.string(),
  year: z.number().int(),
  coreModuleIds: z.array(z.string()),
  allowedElectiveIds: z.array(z.string()),
  electiveEctsRequired: z.number().min(0),
  maxEcts: z.number().positive(),
  iExploreRequired: z.boolean(),
  /** h_{s,j} in spec 8.4: topic coverage of the home programme, used by the breadth score. */
  homeTopics: weightMap(TopicId),
});

export const RuleViolation = z.object({
  code: z.enum([
    'PREREQUISITE_MISSING',
    'NOT_ALLOWED',
    'ECTS_CAP_EXCEEDED',
    'ELECTIVE_ECTS_SHORT',
    'I_EXPLORE_MISSING',
    'UNKNOWN_MODULE',
  ]),
  moduleId: z.string().nullable(),
  message: z.string(),
});

export const RuleWarning = z.object({
  code: z.enum(['TERM_IMBALANCE']),
  message: z.string(),
});

export const RulesResult = z.object({
  ok: z.boolean(),
  violations: z.array(RuleViolation),
  warnings: z.array(RuleWarning),
});

export const ClashLabel = z.enum(['certain', 'likely', 'possible']);

export const Clash = z.object({
  moduleA: z.string(),
  moduleB: z.string(),
  term: Term,
  probability: Fraction,
  label: ClashLabel,
  overlaps: z.array(z.object({ a: Slot, b: Slot })),
});

export const SwapSuggestion = z.object({
  replaceModuleId: z.string(),
  withModuleId: z.string(),
  fit: z.number().int().min(0).max(100),
  fitDelta: z.number().int(),
});

export const TermGrid = z.object({ term: Term, slots: z.array(Slot) });

export const TimetableView = z.object({
  grids: z.array(TermGrid),
  clashes: z.array(Clash),
  swaps: z.array(SwapSuggestion),
  rules: RulesResult,
});

export const ClashPriority = z.object({
  moduleA: z.string(),
  moduleB: z.string(),
  students: z.number().int().min(0),
  probability: Fraction,
  priority: z.number().min(0),
});

export const Pathway = z.object({
  id: PathwayId,
  title: z.string(),
  description: z.string(),
  skills: weightMap(SkillId),
  sampleOpportunities: z.array(z.string()),
});

export const PathwayProgress = z.object({
  pathwayId: PathwayId,
  progress: Fraction,
  perSkill: z.array(z.object({ skill: SkillId, importance: Fraction, covered: Fraction })),
  nextBest: z.object({ moduleId: z.string(), gain: Fraction }).nullable(),
});

export const Society = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  topics: weightMap(TopicId),
  sourceUrl: z.string().url(),
});

export const SocietyMatch = z.object({
  societyId: z.string(),
  fit: z.number().int().min(0).max(100),
  wildcard: z.boolean(),
  reason: z.string(),
});

// ---------- section 12: session state ----------

export const Message = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['student', 'assistant', 'system']),
  agent: z.string().nullable(),
  content: z.string(),
  at: IsoDate,
});

export const InterviewState = z.object({
  depth: z.enum(['quick', 'deep']),
  questionsAsked: z.number().int().min(0),
  budget: z.number().int().min(0),
  finished: z.boolean(),
  confirmed: z.boolean(),
});

export const EscalationDraft = z.object({
  type: EscalationType,
  summary: z.string(),
});

export const SessionState = z.object({
  id: z.string(),
  mode: Mode,
  profile: StudentProfile,
  evidence: z.array(Evidence),
  messages: z.array(Message),
  weights: Weights,
  shortlist: z.array(z.string()),
  interview: InterviewState,
  escalations: z.array(Escalation),
  /** An escalation the agent drafted that the student has not yet approved. */
  escalationDraft: EscalationDraft.nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});

// ---------- section 10: agent contracts ----------

export const Intent = z.enum([
  'answer_interview',
  'ask_why',
  'what_if',
  'edit_profile',
  'shortlist_action',
  'timetable_action',
  'rule_exception_request',
  'pathway_action',
  'smalltalk',
  'out_of_scope',
  'wellbeing',
]);

export const IntentResult = z.object({
  intent: Intent,
  confidence: Fraction,
  moduleIds: z.array(z.string()).default([]),
});

export const ProfileUpdate = z.object({
  slot: z.string(),
  value: z.union([z.number(), z.string()]),
  quote: z.string().max(200),
  confidence: Fraction,
});

export const ExtractorOutput = z.object({ updates: z.array(ProfileUpdate) });

// ---------- section 18: evaluation ----------

export const EvalResult = z.object({
  name: z.string(),
  passed: z.number().int().min(0),
  total: z.number().int().min(0),
  target: Fraction,
  details: z.array(z.object({ case: z.string(), pass: z.boolean(), note: z.string().optional() })),
});

export const EvalRun = z.object({
  id: z.string(),
  at: IsoDate,
  results: z.array(EvalResult),
});

// ---------- section 13: API bodies and responses ----------

export const CreateSessionBody = z.object({
  programme: z.string().min(1),
  yearOfStudy: YearOfStudy,
  completedModuleIds: z.array(z.string()).default([]),
  interviewDepth: z.enum(['quick', 'deep']).default('quick'),
});

export const SendMessageBody = z.object({
  content: z.string().min(1).max(2000),
  /** Structured answers from inline widgets (for example the maths and coding sliders). */
  structured: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export const ProfileEditBody = z.object({
  interests: weightMap(TopicId).optional(),
  pathways: z.array(PathwayId).max(3).optional(),
  pathwaysSkipped: z.boolean().optional(),
  style: Style.partial().optional(),
  breadthAppetite: Fraction.nullable().optional(),
  timetablePrefs: z
    .object({ avoidDays: z.array(Weekday), earliestStart: HHMM.nullable() })
    .partial()
    .optional(),
  /** Confirms the "Here is what I heard" card and leaves the interview. */
  confirm: z.boolean().optional(),
});

export const ShortlistBody = z.object({
  moduleId: z.string(),
  action: z.enum(['add', 'remove']),
});

export const CreateEscalationBody = z.object({
  type: EscalationType,
  summary: z.string().min(1).max(1000),
});

export const InsightDecisionBody = z.object({
  decision: InsightDecision.exclude(['pending']),
});

export const DerivedEditBody = ModuleDerived.omit({ derivedBy: true, derivedRationale: true }).partial();

export const EscalationRespondBody = z.object({
  response: z.string().min(1).max(2000),
  resolve: z.boolean().default(true),
});

export const RecommendationsResponse = z.object({
  weights: Weights,
  confidence: Confidence,
  completeness: Fraction,
  recommendations: z.array(Recommendation),
});

export const ExplanationResponse = z.object({
  explanation: Explanation,
  evidence: z.array(Evidence),
});

export const StaffModuleSummary = z.object({
  moduleId: z.string(),
  code: z.string(),
  title: z.string(),
  type: Module.shape.type,
  capacity: z.number().nullable(),
  shortlisted: z.number().int().min(0),
  averageFit: z.number().min(0).max(100),
  fitHistogram: z.array(z.number().int().min(0)).length(10),
  cohortSize: z.number().int().min(0),
});

export const StaffEscalation = Escalation.extend({
  studentContext: z.object({
    programme: z.string(),
    yearOfStudy: YearOfStudy,
    shortlist: z.array(z.string()),
  }),
});

// ---------- SSE events on POST /sessions/:id/messages ----------

export const SseEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mode'), mode: Mode, from: Mode }),
  z.object({ type: z.literal('token'), text: z.string(), agent: z.string() }),
  z.object({ type: z.literal('profile_update'), profile: StudentProfile, evidence: z.array(Evidence) }),
  z.object({
    type: z.literal('guardrail'),
    stage: z.string(),
    verdict: Verdict,
    notice: z.string().nullable(),
  }),
  z.object({ type: z.literal('recommendations_ready'), count: z.number().int() }),
  z.object({
    type: z.literal('escalation'),
    draft: EscalationDraft.nullable(),
    escalation: Escalation.nullable(),
  }),
  z.object({
    type: z.literal('done'),
    messageId: z.string(),
    /** Optional UI hint, for example an inline slider widget for the next question. */
    widget: z
      .object({ kind: z.enum(['sliders', 'confirm-profile', 'choices']), fields: z.array(z.string()) })
      .nullable(),
  }),
]);
