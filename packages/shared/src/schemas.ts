// Zod schemas for every contract in MODULE_MATCHER_SPEC.md sections 7, 9 and 13.
// Types are inferred from these schemas in ./types.ts, so each contract is defined once.
import { z } from 'zod';
import taxonomy from '../../../data/taxonomy.json' with { type: 'json' };

// ---------- primitives ----------

export const Fraction = z.number().min(0).max(1);
export const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
export const IsoDate = z.string();

/** Controlled vocabulary (spec 7.1): only taxonomy keys pass validation. */
export const TopicId = z.string().refine((k) => Object.hasOwn(taxonomy.topics, k), 'unknown taxonomy topic');
export const SkillId = z.string().refine((k) => Object.hasOwn(taxonomy.skills, k), 'unknown taxonomy skill');
export const PathwayId = z.string().min(1);
export const Term = z.enum(['autumn', 'spring', 'summer']);
export const Weekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri']);
/** Half a weekday to keep free: `wed-pm` is Wednesday afternoon (from 12:00), `mon-am` Monday morning (before 12:00). */
export const HalfDay = z.enum([
  'mon-am', 'mon-pm', 'tue-am', 'tue-pm', 'wed-am', 'wed-pm', 'thu-am', 'thu-pm', 'fri-am', 'fri-pm',
]);
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
  timetablePrefs: z.object({
    avoidDays: z.array(Weekday),
    earliestStart: HHMM.nullable(),
    /** Part-day keep-free answers ("Wednesday afternoons"); absent on profiles saved before part days existed. */
    avoidHalfDays: z.array(HalfDay).optional(),
  }),
  completeness: Fraction,
  updatedAt: IsoDate,
});

/**
 * A profile slot name the Profile Extractor may write (spec 10.3): `interest:<topicId>`, `style.<dimension>`,
 * `breadthAppetite`, `pathways`, `pathwaysSkipped`, `timetablePrefs.avoidDays`, `timetablePrefs.avoidHalfDays` or
 * `timetablePrefs.earliestStart`.
 */
export const SlotName = z.string().refine((slot) => slotValueSchema(slot) !== null, 'slot is not whitelisted');

/** Any value a slot can hold. Use `slotValueSchema(slot)` to validate the value for one specific slot. */
export const SlotValue = z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]);

/** The schema for one slot's value, or null when the slot is not whitelisted. */
export function slotValueSchema(slot: string): z.ZodType | null {
  if (slot.startsWith('interest:')) return TopicId.safeParse(slot.slice('interest:'.length)).success ? Fraction : null;
  if (slot.startsWith('style.')) return slot.slice('style.'.length) in Style.shape ? Fraction : null;
  switch (slot) {
    case 'breadthAppetite':
      return Fraction;
    case 'pathways':
      return z.array(PathwayId).max(3);
    case 'pathwaysSkipped':
      return z.boolean();
    case 'timetablePrefs.avoidDays':
      return z.array(Weekday);
    case 'timetablePrefs.avoidHalfDays':
      return z.array(HalfDay);
    case 'timetablePrefs.earliestStart':
      return HHMM;
    default:
      return null;
  }
}

export const Evidence = z.object({
  id: z.string(),
  sessionId: z.string(),
  turnId: z.string(),
  slot: SlotName,
  value: SlotValue,
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

/**
 * A link for a module: past papers, reading lists, recordings. Provided by staff in data/module-resources.json,
 * keyed by module id, and merged into every module the API serves. It is not stored in SQLite or derived.
 */
export const ModuleResource = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  kind: z.enum(['past-paper', 'reading', 'video', 'other']),
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
    resources: z.array(ModuleResource).default([]),
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

/** The Senior Tutor's decision on a rule exception. An approval makes the module eligible for that session only. */
export const ExceptionDecision = z.enum(['approved', 'declined']);

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
  /** Set when the Senior Tutor decided a rule-exception request for this module (spec 11.1). */
  exception: ExceptionDecision.optional(),
  /**
   * True when the only thing in the way is that the rules for the student's year are not loaded: the module is
   * not refused, its eligibility just cannot be confirmed (issue 51).
   */
  unconfirmed: z.literal(true).optional(),
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

export const RuleViolation = z.object({
  code: z.enum([
    'PREREQUISITE_MISSING',
    'NOT_ALLOWED',
    'ECTS_CAP_EXCEEDED',
    'ELECTIVE_ECTS_SHORT',
    'I_EXPLORE_MISSING',
    'UNKNOWN_MODULE',
    /** Taught in a later year than the student's, and no rule for their year lists it (issue 51). */
    'ABOVE_YEAR_LEVEL',
    /** No rules are loaded for the student's programme and year, so eligibility cannot be confirmed. */
    'RULES_NOT_LOADED',
  ]),
  moduleId: z.string().nullable(),
  /** The missing module, for PREREQUISITE_MISSING, so staff can see the rule as data rather than prose. */
  prerequisiteId: z.string().optional(),
  message: z.string(),
});

/**
 * One broken rule a Senior Tutor waived for one module: the programme check (NOT_ALLOWED), the year-level check,
 * an unconfirmable module in a year with no rules loaded, or one missing prerequisite. Shortlist rules such as
 * the credit cap are never waived; the module's ECTS always count.
 */
export const WAIVABLE_CODES = ['PREREQUISITE_MISSING', 'NOT_ALLOWED', 'ABOVE_YEAR_LEVEL', 'RULES_NOT_LOADED'] as const;

export const RuleWaiver = z.object({
  code: RuleViolation.shape.code.extract(WAIVABLE_CODES),
  prerequisiteId: z.string().optional(),
});

/** An approved rule exception: the module, and exactly the rules that were broken when the student asked. */
export const ModuleException = z.object({
  moduleId: z.string(),
  waived: z.array(RuleWaiver).min(1),
});

/** A one-line reason from the student, asked for in every rule-exception draft. */
export const EXCEPTION_REASON_MAX = 200;

/**
 * What a rule-exception escalation shares with the Senior Tutor, fixed when the student sends it: the broken rule as
 * data, the student's reason, their completed modules and their fit for the module. Staff see this and nothing more.
 */
export const ExceptionRequest = z.object({
  /** The module asked for, or null for a shortlist rule such as the credit cap. */
  moduleId: z.string().nullable(),
  violations: z.array(RuleViolation),
  reason: z.string().max(EXCEPTION_REASON_MAX),
  completedModuleIds: z.array(z.string()),
  fit: Recommendation.pick({ fit: true, sub: true }).nullable(),
});

export const Escalation = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: EscalationType,
  summary: z.string(),
  status: EscalationStatus,
  staffResponse: z.string().nullable(),
  createdAt: IsoDate,
  /** Rule exceptions only. */
  request: ExceptionRequest.nullable().default(null),
  decision: ExceptionDecision.nullable().default(null),
});

export const InsightKind = z.enum(['COUNTERFACTUAL', 'OVERLOOKED', 'DEMAND', 'CLASH']);
export const InsightDecision = z.enum(['pending', 'accepted', 'noted', 'dismissed']);

/** Spec 9.3 insight card. Headline and detail are plain English, with every number from the engine. */
export const Insight = z.object({
  id: z.string(),
  moduleId: z.string(),
  kind: InsightKind,
  headline: z.string(),
  detail: z.string(),
  /** Students behind the card; never under MIN_COHORT (spec 20.4). */
  cohortSize: z.number().int().min(0),
  /**
   * Average fit uplift, in points, of a counterfactual change worth a card of its own. Null for every other
   * kind, and for the counterfactual summary card that stands in for changes too small to act on.
   */
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
  /**
   * False for the stand-in used when data/programme-rules.json has no entry for the programme and year: eligibility
   * then cannot be confirmed, rather than everything being allowed (issue 51).
   */
  loaded: z.boolean().default(true),
  /** The highest module level (the year it is taught in) open to the year, from levelCaps; null when not set. */
  maxModuleLevel: z.number().int().min(1).nullable().default(null),
});

/** Whether the student's programme rules are loaded, shown on the catalogue (issue 51). */
export const RulesStatus = z.object({
  programme: z.string(),
  year: z.number().int(),
  loaded: z.boolean(),
  maxModuleLevel: z.number().int().nullable(),
  /** One sentence for the student, for example that the rules for their year are not loaded. */
  note: z.string(),
});

/** A programme in the rules data and, for each year of study, whether rules are loaded (GET /programmes). */
export const ProgrammeInfo = z.object({
  programme: z.string(),
  years: z.array(z.object({ year: YearOfStudy, rulesLoaded: z.boolean() })),
});

export const RuleWarning = z.object({
  code: z.enum(['TERM_IMBALANCE', 'RULES_NOT_LOADED']),
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
  /** Sessions of the alternative that fall in time the student asked to keep free (a soft constraint). */
  keepFreeConflicts: z.number().int().min(0),
});

/**
 * Issue #68: a backup for a shortlisted option that the synthetic cohort's demand puts near or over capacity.
 * replaceModuleId is the popular pick, withModuleId the backup. canAdd is true when both can be kept.
 */
export const CapacityBackup = SwapSuggestion.extend({
  status: z.enum(['near', 'over']),
  canAdd: z.boolean(),
});

export const TermGrid = z.object({ term: Term, slots: z.array(Slot) });

/** A stretch of the week the student asked to keep free: a whole day, half a day, or before their earliest start. */
export const KeepFreeWindow = z.object({
  day: Weekday,
  from: HHMM,
  to: HHMM,
  reason: z.enum(['day', 'half-day', 'early']),
});

/** A shortlisted session in kept-free time: a soft conflict, shown but never blocking. */
export const KeepFreeConflict = z.object({ moduleId: z.string(), slot: Slot, window: KeepFreeWindow });

export const TimetableView = z.object({
  /** Shortlisted modules plus the compulsory core modules for the student's year, which are locked. */
  grids: z.array(TermGrid),
  /** The core modules drawn on the grids and counted in clash detection. */
  coreModuleIds: z.array(z.string()),
  clashes: z.array(Clash),
  swaps: z.array(SwapSuggestion),
  /**
   * Issue 103: for a clash with no swap within the fit window, the best alternatives beyond it, each with its fit
   * drop. They pass every other swap check; the recommended swaps above are unchanged.
   */
  widerSwaps: z.array(SwapSuggestion),
  /** Backups for picks near or over capacity in the synthetic cohort (issue #68); never a change to fit. */
  backups: z.array(CapacityBackup),
  keepFree: z.array(KeepFreeWindow),
  keepFreeConflicts: z.array(KeepFreeConflict),
  /** ECTS in the plan: core modules, chosen electives and I-Explore, against the programme cap. */
  /** `max` is the programme's credit cap, or null when the rules for the student's year are not loaded (issue 51). */
  ects: z.object({ core: z.number().min(0), elective: z.number().min(0), iExplore: z.number().min(0), max: z.number().min(0).nullable() }),
  rules: RulesResult,
});

/** Whole percentages, 0 to 100. */
const Percent = z.number().int().min(0).max(100);

/**
 * One module in the catalogue's compare view (issue 62): facts from the module record and its published
 * page, and the timetable engine's clashes against the student's shortlist and core modules. Fit and
 * sub-scores are not repeated here: the client shows its live ranking, so the numbers match the cards.
 */
export const CompareModule = z.object({
  moduleId: z.string(),
  code: z.string(),
  title: z.string(),
  ects: z.number().positive(),
  terms: z.array(Term).min(1),
  /**
   * Assessment split in whole percentages that add up to 100. `published` when it comes from the module page's
   * weighted components; `estimated` when the page lists none and the split comes from the record's exam share.
   */
  assessment: z.object({ exam: Percent, coursework: Percent, practical: Percent, source: z.enum(['published', 'estimated']) }),
  mathsPercent: Percent,
  codingPercent: Percent,
  workloadPercent: Percent,
  /** Up to three topic labels, heaviest first. */
  topics: z.array(z.string()).max(3),
  prerequisites: z.array(z.object({ moduleId: z.string(), title: z.string() })),
  slots: z.array(Slot),
  /** Clashes with the shortlist (other than this module) and the core modules, most probable first. */
  clashes: z.array(
    z.object({ withModuleId: z.string(), withTitle: z.string(), core: z.boolean(), term: Term, label: ClashLabel, probability: Fraction }),
  ),
});

export const CompareView = z.object({ modules: z.array(CompareModule).min(2).max(3) });

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
  /** The most pathway-relevant eligible module still to choose, its progress gain and the skill it adds most to. */
  nextBest: z.object({ moduleId: z.string(), gain: Fraction, skill: SkillId }).nullable(),
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
  /** Interview plan steps already asked, so the Interviewer never repeats a question. */
  askedSteps: z.array(z.string()).default([]),
  /** Slots the last question targeted, which lets the extractor read short answers such as "yes". */
  targetSlots: z.array(z.string()).default([]),
  /** Times the student disputed the profile; two disputes offer a LOW_CONFIDENCE escalation (spec 11.1). */
  disputes: z.number().int().min(0).default(0),
});

export const EscalationDraft = z.object({
  type: EscalationType,
  summary: z.string(),
  /** Rule exceptions: the module asked for, the rules it breaks, and a suggested reason the student can edit. */
  moduleId: z.string().nullable().optional(),
  violations: z.array(RuleViolation).optional(),
  reason: z.string().max(EXCEPTION_REASON_MAX).optional(),
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
  /** Rule exceptions the Senior Tutor approved; the rules engine waives exactly those rules for those modules. */
  exceptions: z.array(ModuleException).default([]),
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
  'catalogue_question',
  'smalltalk',
  'out_of_scope',
  'wellbeing',
]);

export const IntentResult = z.object({
  intent: Intent,
  confidence: Fraction,
  moduleIds: z.array(z.string()).default([]),
});

export const ProfileUpdate = z
  .object({
    slot: SlotName,
    value: SlotValue,
    quote: z.string().max(200),
    confidence: Fraction,
  })
  .refine((u) => slotValueSchema(u.slot)?.safeParse(u.value).success === true, {
    message: 'value does not match its slot',
    path: ['value'],
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
    .object({ avoidDays: z.array(Weekday), earliestStart: HHMM.nullable(), avoidHalfDays: z.array(HalfDay) })
    .partial()
    .optional(),
  /** Confirms the "Here is what I heard" card and leaves the interview. */
  confirm: z.boolean().optional(),
  /** Returns to the interview for two more questions when confidence is low (spec 8.6 and 12). */
  resumeInterview: z.boolean().optional(),
});

export const ShortlistBody = z.object({
  moduleId: z.string(),
  action: z.enum(['add', 'remove']),
});

export const CreateEscalationBody = z.object({
  type: EscalationType,
  summary: z.string().min(1).max(1000),
  /** Rule exceptions: the module asked for (the server checks the rules itself) and the student's one-line reason. */
  moduleId: z.string().min(1).optional(),
  reason: z.string().trim().max(EXCEPTION_REASON_MAX).optional(),
});

export const InsightDecisionBody = z.object({
  decision: InsightDecision.exclude(['pending']),
});

export const DerivedEditBody = ModuleDerived.omit({ derivedBy: true, derivedRationale: true }).partial();

export const ESCALATION_REPLY_MAX = 2000;

/**
 * A staff reply. Rule exceptions can carry a decision, and then the message is optional; any other reply needs text.
 * A decision always resolves the escalation.
 */
export const EscalationRespondBody = z
  .object({
    response: z.string().trim().max(ESCALATION_REPLY_MAX).default(''),
    resolve: z.boolean().default(true),
    decision: z.enum(['approve', 'decline']).optional(),
  })
  .refine((b) => b.decision !== undefined || b.response.length > 0, { message: 'a reply is required', path: ['response'] });

export const RecommendationsResponse = z.object({
  weights: Weights,
  confidence: Confidence,
  completeness: Fraction,
  /**
   * fit: ranked by fit score (spec 8.5). starter: the profile has no interests or pathway yet, so there is
   * nothing to score; the list is in a starter order and fit numbers are not shown (spec 8.6).
   */
  ranking: z.enum(['fit', 'starter']),
  recommendations: z.array(Recommendation),
  rules: RulesStatus,
  /** This year's compulsory core modules, already in the student's plan (spec 9.2), so never offered as additions. */
  coreModuleIds: z.array(z.string()),
});

export const ExplanationResponse = z.object({
  explanation: Explanation,
  evidence: z.array(Evidence),
});

/** How the cohort's programme year offers a module: one of its options, compulsory, or not offered at all. */
export const CohortOffer = z.enum(['elective', 'i-explore', 'core', 'not-offered']);

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
  /**
   * From the same programme check the students' recommendations use (before prerequisites). Absent when the cohort's
   * programme and year have no programme rules loaded to read the offer from (issue 51).
   */
  offer: CohortOffer.optional(),
});

/**
 * Aggregate demand for a capped module that is near or over capacity, from the synthetic cohort's shortlists.
 * Only sent when at least MIN_COHORT students are behind the count (spec 20.4); never changes fit or rank.
 */
export const ModuleDemandSignal = z.object({
  moduleId: z.string(),
  status: z.enum(['near', 'over']),
  shortlisted: z.number().int().min(0),
  capacity: z.number().int().positive(),
});

export const StaffEscalation = Escalation.extend({
  studentContext: z.object({
    programme: z.string(),
    yearOfStudy: YearOfStudy,
    shortlist: z.array(z.string()),
  }),
});

/** A short AI summary of a module, written from its public description (GET /modules/:id/summary). */
export const ModuleSummary = z.object({
  moduleId: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()).max(4),
  /** 'model' when written live, 'template' when built from the module record offline. */
  source: z.enum(['model', 'template']),
});

/** Ask the module knowledge agent about one module (POST /sessions/:id/modules/:moduleId/ask, SSE). */
export const AskModuleBody = z.object({ question: z.string().min(1).max(1000) });

/** Pasted CV or personal statement text (POST /sessions/:id/cv). It is redacted before anything is extracted. */
export const CvBody = z.object({ text: z.string().min(1).max(20000) });

export const CvResponse = z.object({
  session: z.lazy(() => SessionState),
  /** Slots the CV filled, so the UI can highlight them. */
  slots: z.array(z.string()),
  redacted: z.boolean(),
});

// ---------- answer feedback (POST /sessions/:id/feedback, GET /staff/feedback) ----------

export const FEEDBACK_COMMENT_MAX = 500;
export const FEEDBACK_EXCERPT_MAX = 600;
export const FEEDBACK_QUESTION_MAX = 1000;

export const FeedbackTargetKind = z.enum(['message', 'module-answer', 'explanation', 'summary']);
export const FeedbackRating = z.enum(['up', 'down']);
export const FeedbackReason = z.enum(['wrong', 'unhelpful', 'unclear', 'unsafe', 'other']);

/**
 * The answer being rated. `id` is the stored assistant message id for `message`, the streamed `done.messageId`
 * for `module-answer`, and the module id for `explanation` and `summary`.
 */
export const FeedbackTarget = z.object({
  kind: FeedbackTargetKind,
  id: z.string().min(1).max(200),
  moduleId: z.string().min(1).max(100).optional(),
});

const feedbackFields = {
  target: FeedbackTarget,
  rating: FeedbackRating,
  /** Why an answer was down-voted. Only allowed with a down-vote. */
  reason: FeedbackReason.optional(),
  comment: z.string().max(FEEDBACK_COMMENT_MAX).optional(),
  /** Client-supplied excerpt of the rated answer, so a down-vote can be reviewed later. Redacted (G2, G3) before storage. */
  answerExcerpt: z.string().max(FEEDBACK_EXCERPT_MAX).optional(),
  /** Client-supplied question the answer replied to. Redacted (G2, G3) before storage. */
  question: z.string().max(FEEDBACK_QUESTION_MAX).optional(),
};

const reasonNeedsDownVote = (f: { rating: string; reason?: string }) => f.rating === 'down' || f.reason === undefined;
const REASON_MESSAGE = { message: 'a reason is only given with a down-vote', path: ['reason'] };

export const Feedback = z
  .object({ id: z.string(), sessionId: z.string(), ...feedbackFields, createdAt: IsoDate })
  .refine(reasonNeedsDownVote, REASON_MESSAGE);

export const FeedbackBody = z.object(feedbackFields).refine(reasonNeedsDownVote, REASON_MESSAGE);

/** Staff view of feedback (GET /staff/feedback). Items carry no session id; all text is already redacted. */
export const FeedbackSummary = z.object({
  total: z.number().int().min(0),
  up: z.number().int().min(0),
  down: z.number().int().min(0),
  byKind: z.array(z.object({ kind: FeedbackTargetKind, up: z.number().int().min(0), down: z.number().int().min(0) })),
  recentDown: z.array(
    z.object({
      id: z.string(),
      kind: FeedbackTargetKind,
      moduleId: z.string().nullable(),
      reason: FeedbackReason.nullable(),
      comment: z.string().nullable(),
      question: z.string().nullable(),
      answerExcerpt: z.string().nullable(),
      createdAt: IsoDate,
    }),
  ),
});

/** One line of GET /staff/feedback/export (JSONL): an eval or fine-tuning seed row, redacted text only. */
export const FeedbackExportRow = z.object({
  question: z.string().nullable(),
  answer: z.string().nullable(),
  rating: FeedbackRating,
  reason: FeedbackReason.nullable(),
  comment: z.string().nullable(),
  kind: FeedbackTargetKind,
  moduleId: z.string().nullable(),
});

// ---------- results and exam feedback (spec section 23) ----------

/** One module result from a student's own transcript or mark sheet, shared with explicit consent. */
export const ModuleResult = z.object({
  /** Catalogue module id when matched, otherwise the code as written on the transcript. */
  moduleId: z.string(),
  code: z.string(),
  title: z.string().nullable(),
  /** Overall mark as a percentage. */
  mark: z.number().min(0).max(100),
  /** Per-question marks, when the mark sheet shows them; needed for tailored exam feedback. */
  questionMarks: z
    .array(
      z
        .object({ questionId: z.string(), mark: z.number().min(0), maxMarks: z.number().positive() })
        .refine((q) => q.mark <= q.maxMarks, { message: 'a question mark cannot exceed its maximum', path: ['mark'] }),
    )
    .default([]),
  matched: z.boolean(),
  source: z.enum(['transcript-pdf', 'transcript-image', 'pasted-text', 'manual']),
});

export const ResultsConsent = z.object({ granted: z.boolean(), at: IsoDate.nullable() });

/** Everything held about a student's marks. Visible to the student only; never shown to staff individually. */
export const StudentResults = z.object({
  consent: ResultsConsent,
  results: z.array(ModuleResult),
  updatedAt: IsoDate.nullable(),
});

/**
 * Upload size limits. Production runs on a Vercel function, which rejects request bodies over 4.5 MB, so a file is
 * capped at 3 MB: about 4 MB once base64 encoded, leaving room for the rest of the JSON body.
 */
export const RESULTS_FILE_MAX_BYTES = 3_000_000;
/** Base64 length of the largest allowed file: every 3 bytes become 4 characters. */
export const RESULTS_BASE64_MAX = Math.ceil(RESULTS_FILE_MAX_BYTES / 3) * 4;
/** The whole JSON body: the largest file plus the text, the field names and some slack, still under 4.5 MB. */
export const RESULTS_BODY_MAX_BYTES = RESULTS_BASE64_MAX + 200_000;

/** Upload a transcript or mark sheet. Consent must be given explicitly with every upload. */
export const ResultsUploadBody = z
  .object({
    consent: z.literal(true),
    text: z.string().min(1).max(20000).optional(),
    file: z
      .object({
        mediaType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
        /** Base64 file contents, at most 3 MB once decoded (RESULTS_FILE_MAX_BYTES). */
        base64: z
          .string()
          .min(4)
          .max(RESULTS_BASE64_MAX)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'file must be non-empty base64'),
      })
      .optional(),
  })
  .refine((b) => b.text !== undefined || b.file !== undefined, 'text or file is required');

export const ResultsUploadResponse = z.object({
  results: StudentResults,
  /** Codes on the transcript that match no catalogue module (kept, but not used for nudges). */
  unmatched: z.array(z.string()),
  source: z.enum(['model', 'parser']),
});

/** How a student did on a topic, from the modules they took that teach it, against their own average. */
export const TopicStrength = z.object({
  topic: TopicId,
  /** Topic-weighted average mark across the student's modules on this topic. */
  average: z.number().min(0).max(100),
  /** average minus the student's overall average, in marks; negative means weaker than usual. */
  delta: z.number(),
  modules: z.array(z.string()),
});

/** An informational nudge on a module: it never changes the fit score. */
export const PerformanceNudge = z.object({
  moduleId: z.string(),
  topics: z.array(TopicId),
  delta: z.number(),
  message: z.string(),
});

export const PerformanceView = z.object({
  consent: z.boolean(),
  overallAverage: z.number().min(0).max(100).nullable(),
  topics: z.array(TopicStrength),
  nudges: z.array(PerformanceNudge),
});

/** One exam question as described by the examiner. */
export const ExamQuestion = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  maxMarks: z.number().positive(),
  topics: z.array(TopicId),
  whatGoodAnswersDid: z.string(),
  commonMistakes: z.array(z.string()),
  revisionPointers: z.array(z.string()),
});

/** The examiner's feedback form for one exam: cohort-level, never about an individual student. */
export const ExamFeedbackForm = z.object({
  id: z.string(),
  moduleId: z.string(),
  examLabel: z.string().min(1),
  // Student marks refer to questions by id, so ids must be unique within a form.
  questions: z
    .array(ExamQuestion)
    .min(1)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, 'question ids must be unique'),
  generalComments: z.string(),
  status: z.enum(['draft', 'published']),
  /** 'ai-draft' until an examiner edits or publishes it; drafts are never shown to students. */
  authoredBy: z.enum(['examiner', 'ai-draft']),
  updatedAt: IsoDate,
});

export const ExamFormSaveBody = ExamFeedbackForm.omit({ id: true, moduleId: true, status: true, authoredBy: true, updatedAt: true });

/** The examiner pastes marking notes and an AI agent drafts the structured form for them to review. */
export const ExamFormDraftBody = z.object({ examLabel: z.string().min(1), notes: z.string().min(1).max(20000) });

/** Feedback for one student on one exam, from the examiner's form and the student's own question marks. */
/**
 * A published exam whose feedback the student cannot get yet: they shared a mark for the module, but no question
 * marks that match the examiner's questions (issue #108). Says nothing about anyone else's marks.
 */
export const ExamAwaitingMarks = z.object({
  moduleId: z.string(),
  examLabel: z.string(),
  /** The question ids the examiner's form uses, so the student knows what their mark sheet needs to show. */
  questionIds: z.array(z.string()),
});

export const TailoredFeedback = z.object({
  moduleId: z.string(),
  examLabel: z.string(),
  /** The student's overall mark on this exam, for the at-a-glance strip. */
  mark: z.number().min(0).max(100).optional(),
  /** Every question the student has a mark for, in paper order, for the per-question chart. */
  questions: z
    .array(z.object({ questionId: z.string(), label: z.string(), mark: z.number().min(0), maxMarks: z.number().positive() }))
    .optional(),
  /** One sentence naming where most marks went; the numbers live in the chart, so it does not repeat them. */
  overall: z.string(),
  strengths: z.array(z.string()),
  weakPoints: z.array(
    z.object({
      questionId: z.string(),
      /** The question's subject without its "Q3:" prefix, such as "Boundary layers and the Blasius solution". */
      label: z.string().optional(),
      topics: z.array(TopicId),
      lostMarks: z.number().min(0),
      /** The examiner's common mistakes and what good answers did; the marks lost are shown in the chart instead. */
      advice: z.string(),
    }),
  ),
  revisionPlan: z.array(z.string()),
  /** Future modules that build on the weak topics, with a short note each. */
  affectsModules: z.array(z.object({ moduleId: z.string(), note: z.string() })),
  source: z.enum(['model', 'template']),
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
    /** The stored assistant message id (chat) or a fresh id (module Q&A). Empty when the reply was not stored. */
    messageId: z.string(),
    /** Optional UI hint, for example an inline slider widget for the next question. */
    widget: z
      .object({ kind: z.enum(['sliders', 'confirm-profile', 'choices']), fields: z.array(z.string()) })
      .nullable(),
  }),
]);
