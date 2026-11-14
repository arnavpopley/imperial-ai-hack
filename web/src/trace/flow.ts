// The real request path from docs/ARCHITECTURE.md as data: the steps, their one-line descriptions, two
// layouts (wide and phone) and a mapping from trace events to the steps they show were used.
import type { TraceEvent } from '@modulematch/shared';

export type NodeId =
  | 'student'
  | 'g1'
  | 'g2'
  | 'g3'
  | 'g4'
  | 'supervisor'
  | 'interviewer'
  | 'extractor'
  | 'matcher'
  | 'timetabler'
  | 'scoring'
  | 'rules'
  | 'timetable'
  | 'insights'
  | 'g5'
  | 'g6'
  | 'g7'
  | 'g8'
  | 'reply'
  | 'escalation'
  | 'staff';

export type GroupId = 'input' | 'agents' | 'engines' | 'output';

export interface FlowNode {
  id: NodeId;
  label: string;
  description: string;
  /** Position in the reveal sequence, left to right. */
  stage: number;
  group?: GroupId;
}

export const NODES: readonly FlowNode[] = [
  { id: 'student', label: 'Student message', stage: 0, description: 'A student types into the interview or the advisor chat.' },
  { id: 'g1', group: 'input', label: 'G1 Scope', stage: 1, description: 'Is this about modules? If not, it steers back to what the advisor can help with.' },
  { id: 'g2', group: 'input', label: 'G2 Redaction', stage: 1, description: 'Removes personal disclosures, such as health or background, before anything is stored.' },
  { id: 'g3', group: 'input', label: 'G3 Injection', stage: 1, description: 'Strips attempts to give the AI new instructions; the rest is treated as plain data.' },
  { id: 'g4', group: 'input', label: 'G4 Wellbeing', stage: 1, description: 'Spots distress: advising stops, support contacts appear, and a hand-off to a person is offered.' },
  { id: 'supervisor', label: 'Supervisor', stage: 2, description: 'Works out what the student wants, moves the mode on, and picks which agent replies.' },
  { id: 'interviewer', group: 'agents', label: 'Interviewer', stage: 3, description: 'Asks the next most useful question about interests, goals and how the student likes to learn.' },
  { id: 'extractor', group: 'agents', label: 'Profile Extractor', stage: 3, description: 'Turns each answer into profile values, each tied to the exact quote it came from.' },
  { id: 'matcher', group: 'agents', label: 'Matcher', stage: 3, description: 'Explains the ranked modules. Every reason cites a quote or a field of the module record.' },
  { id: 'timetabler', group: 'agents', label: 'Timetabler', stage: 3, description: 'Puts the clashes and swaps the timetable engine found into plain words.' },
  { id: 'scoring', group: 'engines', label: 'Scoring', stage: 4, description: 'Plain code, not AI: a fit score from 0 to 100 from interests, goals, style and breadth.' },
  { id: 'rules', group: 'engines', label: 'Rules', stage: 4, description: 'Prerequisites, credit caps and programme rules. No agent can override it.' },
  { id: 'timetable', group: 'engines', label: 'Timetable', stage: 4, description: 'Finds overlaps, the chance of a clash, and swaps that cost under 10 fit points.' },
  { id: 'insights', group: 'engines', label: 'Insights', stage: 4, description: 'Cohort patterns for staff, never shown for a group of fewer than five students.' },
  { id: 'g5', group: 'output', label: 'G5 Schema', stage: 5, description: "Checks the reply's shape; retries once, then falls back to a safe template." },
  { id: 'g6', group: 'output', label: 'G6 Grounding', stage: 5, description: 'Every quote and module field the reply cites must really exist.' },
  { id: 'g7', group: 'output', label: 'G7 Rules', stage: 5, description: 'Removes any suggestion the student is not eligible for, and offers an escalation.' },
  { id: 'g8', group: 'output', label: 'G8 Claims', stage: 5, description: 'Removes promises about grades, jobs or outcomes before the student sees them.' },
  { id: 'reply', label: 'Reply', stage: 6, description: 'The student sees the checked answer in the chat, with its evidence one tap away.' },
  { id: 'escalation', label: 'Escalation', stage: 3, description: 'When the AI should not decide alone, it drafts a summary that the student approves.' },
  { id: 'staff', label: 'Staff console', stage: 4, description: "A person replies in the staff console, and the answer lands in the student's chat." },
];

export const GROUP_LABELS: Record<GroupId, string> = {
  input: 'Input safety checks',
  agents: 'AI agents',
  engines: 'Engines (plain code)',
  output: 'Output safety checks',
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowEdge {
  id: string;
  d: string;
  /** Step in the pulse sequence; edges with the same step pulse together. */
  step: number;
  dashed?: boolean;
}

export interface FlowLayout {
  width: number;
  height: number;
  groups: Record<GroupId, Box>;
  nodes: Record<NodeId, Box>;
  edges: readonly FlowEdge[];
}

const groupNodes = (group: GroupId) => NODES.filter((n) => n.group === group).map((n) => n.id);

/** Wide screens: left to right, with the escalation branch running underneath. */
function wide(): FlowLayout {
  const groupW = 156;
  const nodeW = 136;
  const nodeH = 38;
  const top = 40;
  const groupH = 34 + 4 * nodeH + 3 * 10 + 14;
  const cy = top + groupH / 2;
  const centres: Record<GroupId, number> = { input: 250, agents: 610, engines: 790, output: 970 };

  const groups = {} as Record<GroupId, Box>;
  const nodes = {} as Record<NodeId, Box>;
  for (const g of Object.keys(centres) as GroupId[]) {
    groups[g] = { x: centres[g] - groupW / 2, y: top, w: groupW, h: groupH };
    groupNodes(g).forEach((id, i) => {
      nodes[id] = { x: centres[g] - nodeW / 2, y: top + 34 + i * (nodeH + 10), w: nodeW, h: nodeH };
    });
  }
  const single = (cx: number, y: number, w: number): Box => ({ x: cx - w / 2, y, w, h: 56 });
  nodes.student = single(72, cy - 28, 120);
  nodes.supervisor = single(430, cy - 28, 124);
  nodes.reply = single(1122, cy - 28, 100);
  nodes.escalation = single(430, 372, 140);
  nodes.staff = single(640, 372, 150);

  const right = (b: Box) => b.x + b.w;
  const h = (from: number, to: number) => `M${from} ${cy} H${to}`;
  const edges: FlowEdge[] = [
    { id: 'student-input', step: 0, d: h(right(nodes.student), groups.input.x) },
    { id: 'input-supervisor', step: 1, d: h(right(groups.input), nodes.supervisor.x) },
    { id: 'supervisor-agents', step: 2, d: h(right(nodes.supervisor), groups.agents.x) },
    { id: 'agents-engines', step: 3, d: h(right(groups.agents), groups.engines.x) },
    { id: 'engines-output', step: 4, d: h(right(groups.engines), groups.output.x) },
    { id: 'output-reply', step: 5, d: h(right(groups.output), nodes.reply.x) },
    { id: 'supervisor-escalation', step: 2, d: `M430 ${cy + 28} V${nodes.escalation.y}` },
    { id: 'escalation-staff', step: 3, d: `M${right(nodes.escalation)} 400 H${nodes.staff.x}` },
    {
      id: 'staff-reply',
      step: 4,
      dashed: true,
      d: `M${right(nodes.staff)} 400 H1122 V${cy + 28}`,
    },
  ];
  return { width: 1180, height: 450, groups, nodes, edges };
}

/** Phones: top to bottom, two steps per row inside each group, the escalation branch down the right edge. */
function narrow(): FlowLayout {
  const groupX = 20;
  const groupW = 320;
  const nodeW = 148;
  const nodeH = 40;
  const groupH = 32 + 2 * nodeH + 8 + 14;
  const groups = {} as Record<GroupId, Box>;
  const nodes = {} as Record<NodeId, Box>;
  const single = (y: number, w = 200): Box => ({ x: 180 - w / 2, y, w, h: 56 });

  nodes.student = single(10);
  let y = 10 + 56 + 34;
  const place = (g: GroupId) => {
    groups[g] = { x: groupX, y, w: groupW, h: groupH };
    groupNodes(g).forEach((id, i) => {
      nodes[id] = {
        x: groupX + 8 + (i % 2) * (nodeW + 8),
        y: y + 32 + Math.floor(i / 2) * (nodeH + 8),
        w: nodeW,
        h: nodeH,
      };
    });
    y += groupH + 34;
  };
  place('input');
  nodes.supervisor = single(y);
  y += 56 + 34;
  place('agents');
  place('engines');
  place('output');
  nodes.reply = single(y);
  y += 56 + 60;
  nodes.escalation = single(y);
  y += 56 + 34;
  nodes.staff = single(y);
  const height = y + 56 + 10;

  const bottom = (b: Box) => b.y + b.h;
  const v = (from: number, to: number) => `M180 ${from} V${to}`;
  const sup = nodes.supervisor;
  const edges: FlowEdge[] = [
    { id: 'student-input', step: 0, d: v(bottom(nodes.student), groups.input.y) },
    { id: 'input-supervisor', step: 1, d: v(bottom(groups.input), sup.y) },
    { id: 'supervisor-agents', step: 2, d: v(bottom(sup), groups.agents.y) },
    { id: 'agents-engines', step: 3, d: v(bottom(groups.agents), groups.engines.y) },
    { id: 'engines-output', step: 4, d: v(bottom(groups.engines), groups.output.y) },
    { id: 'output-reply', step: 5, d: v(bottom(groups.output), nodes.reply.y) },
    {
      id: 'supervisor-escalation',
      step: 2,
      d: `M${sup.x + sup.w} ${sup.y + 28} H352 V${nodes.escalation.y + 28} H${nodes.escalation.x + nodes.escalation.w}`,
    },
    { id: 'escalation-staff', step: 3, d: v(bottom(nodes.escalation), nodes.staff.y) },
    {
      id: 'staff-reply',
      step: 4,
      dashed: true,
      d: `M${nodes.staff.x} ${nodes.staff.y + 28} H8 V${nodes.reply.y + 28} H${nodes.reply.x}`,
    },
  ];
  return { width: 360, height, groups, nodes, edges };
}

export const LAYOUTS = { wide: wide(), narrow: narrow() } as const;

const TOOL_NODES: readonly [RegExp, NodeId][] = [
  [/score_modules|get_module|get_evidence/, 'scoring'],
  [/check_rules/, 'rules'],
  [/find_clashes|suggest_swaps|build_timetable/, 'timetable'],
  [/cohort_stats|counterfactual|clash_priorities/, 'insights'],
];

const ACTOR_NODES: Record<string, NodeId> = {
  supervisor: 'supervisor',
  interviewer: 'interviewer',
  extractor: 'extractor',
  matcher: 'matcher',
  timetabler: 'timetabler',
  staff: 'staff',
};

/** The steps a session's trace shows were used, for highlighting on the flowchart. */
export function nodesInTrace(events: readonly TraceEvent[]): Set<NodeId> {
  const seen = new Set<NodeId>();
  for (const e of events) {
    const actor = e.actor.toLowerCase();
    const stage = /^g([1-8])\b/.exec(actor);
    if (stage) seen.add(`g${stage[1]}` as NodeId);
    const agent = ACTOR_NODES[actor];
    if (agent) seen.add(agent);
    if (e.kind === 'escalation') seen.add('escalation');
    if (e.kind === 'tool') for (const [pattern, id] of TOOL_NODES) if (pattern.test(e.input)) seen.add(id);
  }
  if (seen.size > 0) {
    seen.add('student');
    seen.add('reply');
  }
  return seen;
}
