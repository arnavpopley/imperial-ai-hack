// An animated flowchart of the agent process: steps appear in order, a pulse travels along each edge, and
// hovering, focusing or tapping a step shows what it does. Steps a session's trace used can be highlighted.
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../components/cx.ts';
import { GROUP_LABELS, LAYOUTS, NODES, type FlowNode, type GroupId, type NodeId, type UsedId } from './flow.ts';

const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
const STEP_SECONDS = 0.7;
const MAIN_STEPS = 6;
const CYCLE = MAIN_STEPS * STEP_SECONDS + 1.2;

function useWide(): boolean {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setWide(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return wide;
}

interface AgentFlowchartProps {
  /** Steps used in the selected session's trace; they are drawn highlighted. */
  seen?: ReadonlySet<UsedId>;
}

export function AgentFlowchart({ seen }: AgentFlowchartProps) {
  const wide = useWide();
  const layout = wide ? LAYOUTS.wide : LAYOUTS.narrow;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const [active, setActive] = useState<NodeId>('supervisor');
  const markerId = useId();
  const titleId = useId();
  const highlight = seen && seen.size > 0 ? seen : null;
  const current = NODE_BY_ID.get(active);

  return (
    <div ref={ref} className="grid gap-5">
      <div className="rounded-panel bg-surface p-3 shadow-soft ring-1 ring-line sm:p-6">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
          aria-labelledby={titleId}
          className="mx-auto block h-auto w-full max-w-[1180px] select-none"
        >
          <title id={titleId}>The agent process, from a student message to the reply</title>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" className="fill-line-strong" />
            </marker>
          </defs>

          {(Object.keys(layout.groups) as GroupId[]).map((g) => {
            const box = layout.groups[g];
            const stage = NODES.find((n) => n.group === g)?.stage ?? 0;
            return (
              <motion.g
                key={g}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{ duration: 0.4, delay: stage * 0.18 }}
                aria-hidden="true"
              >
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={18} className="fill-surface-2 stroke-line" />
                <text
                  x={box.x + box.w / 2}
                  y={box.y + 21}
                  textAnchor="middle"
                  className="fill-muted text-2xs font-semibold tracking-[0.02em] uppercase"
                >
                  {GROUP_LABELS[g]}
                </text>
              </motion.g>
            );
          })}

          {layout.edges.map((edge) => (
            <g key={edge.id} aria-hidden="true">
              <motion.path
                d={edge.d}
                fill="none"
                strokeWidth={2}
                strokeDasharray={edge.dashed ? '6 6' : undefined}
                markerEnd={`url(#${markerId})`}
                markerStart={edge.twoWay ? `url(#${markerId})` : undefined}
                className="stroke-line-strong"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{ duration: 0.4, delay: 0.1 + edge.step * 0.18 }}
              />
              {!reduce && inView && (
                <motion.path
                  d={edge.d}
                  fill="none"
                  pathLength={1}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="0.14 1.3"
                  className={edge.id.startsWith('supervisor-escalation') || edge.id.startsWith('escalation') || edge.id.startsWith('staff') ? 'stroke-mode-escalated' : 'stroke-brand'}
                  initial={{ strokeDashoffset: 0.14 }}
                  animate={{ strokeDashoffset: -1.16 }}
                  transition={{
                    duration: STEP_SECONDS,
                    ease: 'easeInOut',
                    delay: 1.4 + edge.step * STEP_SECONDS,
                    repeat: Infinity,
                    repeatDelay: CYCLE - STEP_SECONDS,
                  }}
                />
              )}
            </g>
          ))}

          {NODES.map((node, i) => (
            <FlowNodeShape
              key={node.id}
              node={node}
              box={layout.nodes[node.id]}
              index={i}
              inView={inView}
              active={active === node.id}
              lit={highlight?.has(node.id) ?? false}
              dimmed={highlight !== null && !highlight.has(node.id)}
              onActivate={() => setActive(node.id)}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <p aria-live="polite" className="min-h-14 max-w-2xl rounded-2xl bg-brand-soft/60 px-5 py-3 text-sm leading-relaxed">
          {current && (
            <>
              <span className="font-semibold">{current.label}.</span> {current.description}
            </>
          )}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-6 rounded-full bg-brand" /> Normal path
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-6 rounded-full bg-mode-escalated" /> Handed to a person
          </li>
          {highlight && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-full bg-fit-high" /> Used in this session
            </li>
          )}
        </ul>
      </div>

      <details className="rounded-2xl bg-surface-2 px-5 py-4 text-sm">
        <summary className="cursor-pointer font-medium">Read the process as text</summary>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 leading-relaxed text-muted">
          <li>{text('student')}</li>
          <li>Input safety checks run on the message: {list(['g1', 'g2', 'g3', 'g4'])}</li>
          <li>{text('supervisor')}</li>
          <li>One agent handles the turn: {list(['interviewer', 'extractor', 'matcher', 'timetabler', 'catalogue'])}</li>
          <li>Agents call engines for every number: {list(['scoring', 'rules', 'timetable', 'catalogueTools'])}</li>
          <li>Output safety checks run on the reply: {list(['g5', 'g6', 'g7', 'g8'])}</li>
          <li>{text('reply')}</li>
          <li>
            Branch: {text('escalation')} {text('staff')}
          </li>
          <li>
            Staff side: {text('insights')} {text('insightsAgent')}
          </li>
        </ol>
      </details>
    </div>
  );
}

const text = (id: NodeId) => {
  const n = NODE_BY_ID.get(id);
  return n ? `${n.label}: ${n.description}` : '';
};
function list(ids: readonly NodeId[]) {
  return (
    <ul className="mt-1 grid list-disc gap-1 pl-5">
      {ids.map((id) => (
        <li key={id}>{text(id)}</li>
      ))}
    </ul>
  );
}

interface FlowNodeShapeProps {
  node: FlowNode;
  box: { x: number; y: number; w: number; h: number };
  index: number;
  inView: boolean;
  active: boolean;
  lit: boolean;
  dimmed: boolean;
  onActivate: () => void;
}

function FlowNodeShape({ node, box, index, inView, active, lit, dimmed, onActivate }: FlowNodeShapeProps) {
  const big = node.kind !== undefined;
  const escalation = node.kind === 'handoff';
  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${node.label}: ${node.description}`}
      aria-pressed={active}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: dimmed ? 0.45 : 1, y: 0 } : undefined}
      transition={{ duration: 0.45, delay: 0.15 + node.stage * 0.18 + (index % 4) * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ scale: 1.04 }}
      style={{ transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`, transformBox: 'view-box' }}
      className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-brand [&:focus-visible>rect]:stroke-[3]"
    >
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={big ? 16 : 11}
        strokeWidth={active ? 2.5 : 1.5}
        className={cx(
          'transition-colors',
          big
            ? escalation
              ? 'fill-mode-escalated/10 stroke-mode-escalated/60'
              : 'fill-brand stroke-brand'
            : 'fill-surface stroke-line',
          active && !big && 'stroke-brand',
          active && big && 'stroke-ink',
        )}
      />
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className={cx(
          'pointer-events-none',
          // The chart's boxes were sized for these labels: hubs at the xs step, so "Student message" fits its box.
          big ? 'text-xs font-semibold' : 'text-xs font-medium',
          big && !escalation ? 'fill-on-brand' : 'fill-ink',
        )}
      >
        {node.label}
      </text>
      {lit && <circle cx={box.x + box.w - 9} cy={box.y + 9} r={5} className="fill-fit-high stroke-surface" strokeWidth={2} />}
    </motion.g>
  );
}
