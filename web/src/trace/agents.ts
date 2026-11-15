// Every AI agent in ModuleMatch, as data for the "How it works" roster and the landing page. Each entry mirrors the
// code: the model tier is the one the agent passes to server/src/agents/llm.ts (or the env var its script reads), the
// tools are the ones it calls, and "never" is a rule the code enforces.
import type { BadgeTone } from '../components/Badge.tsx';
import type { IconName } from '../components/Icon.tsx';
import type { UsedId } from './flow.ts';

export type Audience = 'student' | 'staff' | 'offline';
export type Tier = 'smart' | 'fast' | 'light';

export interface Agent {
  /** Matches the trace actor, so the card lights up once the session has used the agent. */
  id: UsedId | 'examDrafter' | 'analyst';
  name: string;
  icon: IconName;
  audience: Audience;
  tier: Tier;
  /** Tools or engine calls it makes (snake_case for real tool names); empty when its input is passed in as data. */
  tools: readonly string[];
  /** One short line. */
  does: string;
  /** Finishes the sentence "Never ...". */
  never: string;
  /** Solid fill for the agent's badge, from the theme's mode and art colours. */
  fill: string;
  /** Text colour for the "never" line. */
  tone: string;
  /** The badge when the models are off, if not "Template (offline)": an agent with no template says so. */
  offlineLabel?: string;
}

export const AGENTS: readonly Agent[] = [
  {
    id: 'supervisor',
    name: 'Supervisor',
    icon: 'compass',
    audience: 'student',
    tier: 'light',
    tools: ['Mode machine', 'Escalation drafts'],
    does: 'Reads each message and picks who replies.',
    never: 'sends an escalation without your OK.',
    fill: 'bg-brand',
    tone: 'text-brand',
  },
  {
    id: 'interviewer',
    name: 'Interviewer',
    icon: 'chat',
    audience: 'student',
    tier: 'smart',
    tools: [],
    does: 'Asks the next most useful question.',
    never: 'asks about grades or health.',
    fill: 'bg-mode-interview',
    tone: 'text-mode-interview',
  },
  {
    id: 'extractor',
    name: 'Profile Extractor',
    icon: 'user',
    audience: 'student',
    tier: 'fast',
    tools: [],
    does: 'Turns answers into a profile.',
    never: 'stores a value without your quote.',
    fill: 'bg-mode-explain',
    tone: 'text-mode-explain',
  },
  {
    id: 'matcher',
    name: 'Matcher',
    icon: 'sparkle',
    audience: 'student',
    tier: 'smart',
    tools: ['score_modules', 'check_rules'],
    does: 'Explains each ranking with evidence.',
    never: 'changes a fit score.',
    fill: 'bg-mode-recommend',
    tone: 'text-mode-recommend',
  },
  {
    id: 'timetabler',
    name: 'Timetabler',
    icon: 'calendar',
    audience: 'student',
    tier: 'light',
    tools: ['find_clashes'],
    does: 'Explains clashes and the cheapest swaps.',
    never: 'makes a swap you have not confirmed.',
    fill: 'bg-mode-plan',
    tone: 'text-mode-plan',
  },
  {
    id: 'catalogue',
    name: 'Catalogue',
    icon: 'search',
    audience: 'student',
    tier: 'smart',
    tools: ['search_modules', 'get_module', 'compare_modules'],
    does: 'Searches the whole catalogue in a tool loop.',
    never: 'names a module code that is not in the catalogue.',
    fill: 'bg-art-2',
    tone: 'text-art-2',
  },
  {
    id: 'knowledge',
    name: 'Module knowledge',
    icon: 'tutor',
    audience: 'student',
    tier: 'smart',
    tools: [],
    does: 'Summarises a module and answers questions on it.',
    never: "goes beyond the module's own page.",
    fill: 'bg-art-5',
    tone: 'text-art-3',
  },
  {
    id: 'resultsReader',
    name: 'Results reader',
    icon: 'lock',
    audience: 'student',
    tier: 'fast',
    tools: [],
    does: 'Reads an uploaded transcript or mark sheet.',
    never: 'reads your marks without your consent.',
    fill: 'bg-art-8',
    tone: 'text-art-8',
    // Reading a PDF or photo needs the model; offline, students paste the text and a parser reads it.
    offlineLabel: 'Off (offline)',
  },
  {
    id: 'examFeedback',
    name: 'Exam feedback',
    icon: 'mountain',
    audience: 'student',
    tier: 'smart',
    tools: [],
    does: 'Turns your marks into tailored revision advice.',
    never: 'states a number the exam facts do not contain.',
    fill: 'bg-art-4',
    tone: 'text-art-4',
  },
  {
    id: 'insightsAgent',
    name: 'Insights',
    icon: 'chart',
    audience: 'staff',
    tier: 'smart',
    tools: [],
    does: 'Words cohort insight cards for module leads.',
    never: 'changes a number from the engine.',
    fill: 'bg-art-6',
    tone: 'text-art-6',
  },
  {
    id: 'examDrafter',
    name: 'Exam form drafter',
    icon: 'edit',
    audience: 'staff',
    tier: 'smart',
    tools: [],
    does: 'Drafts a feedback form from marking notes.',
    never: 'reaches students before an examiner publishes it.',
    fill: 'bg-art-1',
    tone: 'text-art-1',
  },
  {
    id: 'analyst',
    name: 'Module Analyst',
    icon: 'chip',
    audience: 'offline',
    tier: 'smart',
    tools: ['record_module_analysis'],
    does: 'Tags each module with topics, skills and demand.',
    never: 'weights a topic highly without a quote.',
    fill: 'bg-art-7',
    tone: 'text-art-7',
  },
];

export const AUDIENCES: readonly { id: Audience; label: string }[] = [
  { id: 'student', label: 'Student-facing' },
  { id: 'staff', label: 'Staff-facing' },
  { id: 'offline', label: 'Offline' },
];

/**
 * The model behind each tier (server/src/agents/llm.ts defaults), and what it is used for. Every model is AI, so the
 * badge tones only tell the tiers apart.
 */
export const TIERS: Record<Tier, { model: string; use: string; tone: BadgeTone }> = {
  smart: { model: 'Opus 5.5', use: 'What students read', tone: 'brand' },
  fast: { model: 'Sonnet 5.5', use: 'Extraction', tone: 'ai' },
  light: { model: 'Haiku 4.5', use: 'Intent and classifiers', tone: 'info' },
};

/** The evaluation judge (MODEL_JUDGE): grades the agents in the live evals, never talks to a student. */
export const JUDGE = { model: 'Fable 5.1', use: 'Grades the live evals' } as const;

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** "Nine", for headings; falls back to digits past twelve. */
export const countWord = (n: number) => WORDS[n] ?? String(n);
