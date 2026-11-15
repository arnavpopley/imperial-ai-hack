// The flowchart's data: every step has a box in both layouts, boxes never overlap, edges stay on the canvas, the
// Catalogue agent's tool loop and the staff insights path are drawn, and trace events light the right steps.
import type { TraceEvent } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { LAYOUTS, NODES, nodesInTrace, type Box } from './flow.ts';

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/** The points an SVG path of M, H and V commands visits. */
function points(d: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const [, cmd, args] of d.matchAll(/([MHV])\s*([-\d.\s]+)/g)) {
    const n = args!.trim().split(/\s+/).map(Number);
    if (cmd === 'M') [x, y] = [n[0]!, n[1]!];
    else if (cmd === 'H') x = n[0]!;
    else y = n[0]!;
    out.push([x, y]);
  }
  return out;
}

const event = (actor: string, kind: TraceEvent['kind'], input: string): TraceEvent => ({
  id: `${actor}-${input}`,
  sessionId: 's1',
  at: '2026-11-15T09:00:00.000Z',
  actor,
  kind,
  input,
  output: '',
  verdict: null,
  latencyMs: 1,
});

describe.each(Object.entries(LAYOUTS))('%s layout', (_, layout) => {
  it('places every step once, inside its group, with no overlaps', () => {
    expect(Object.keys(layout.nodes).sort()).toEqual(NODES.map((n) => n.id).sort());
    for (const node of NODES) if (node.group) expect(inside(layout.nodes[node.id], layout.groups[node.group]), node.id).toBe(true);
    const boxes = NODES.map((n) => [n.id, layout.nodes[n.id]] as const);
    for (const [i, [a, boxA]] of boxes.entries()) {
      for (const [b, boxB] of boxes.slice(i + 1)) expect(overlaps(boxA, boxB), `${a} overlaps ${b}`).toBe(false);
    }
  });

  it('keeps every box and edge on the canvas', () => {
    for (const box of [...Object.values(layout.nodes), ...Object.values(layout.groups)]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.height);
    }
    for (const edge of layout.edges) {
      for (const [x, y] of points(edge.d)) {
        expect(x, edge.id).toBeGreaterThanOrEqual(0);
        expect(x, edge.id).toBeLessThanOrEqual(layout.width);
        expect(y, edge.id).toBeGreaterThanOrEqual(0);
        expect(y, edge.id).toBeLessThanOrEqual(layout.height);
      }
    }
  });

  it("draws the Catalogue agent's tool loop and the staff insights path", () => {
    const ids = layout.edges.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['catalogue-tools', 'insights-agent', 'insights-staff']));
    expect(layout.edges.find((e) => e.id === 'catalogue-tools')?.twoWay).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('nodesInTrace', () => {
  it('lights nothing for an empty trace', () => {
    expect(nodesInTrace([]).size).toBe(0);
  });

  it('lights the Catalogue agent and its tools from catalogue tool calls', () => {
    const seen = nodesInTrace([
      event('catalogue', 'agent', 'catalogue question in RECOMMEND'),
      event('catalogue', 'tool', 'search_modules({"query":"python"})'),
    ]);
    expect([...seen]).toEqual(expect.arrayContaining(['catalogue', 'catalogueTools', 'student', 'reply']));
  });

  it('lights the module knowledge agent from a module question', () => {
    expect(nodesInTrace([event('knowledge', 'agent', 'question about MECH60006')]).has('knowledge')).toBe(true);
  });

  it('lights the results reader and exam feedback agents from their trace actors', () => {
    const seen = nodesInTrace([event('results reader', 'agent', 'application/pdf upload (40 KB)'), event('exam feedback', 'agent', 'feedback on MECH60006')]);
    expect([...seen]).toEqual(expect.arrayContaining(['resultsReader', 'examFeedback']));
  });

  it('maps guardrails, engine calls and escalations to their steps', () => {
    const seen = nodesInTrace([
      event('G3 injection', 'guardrail', 'turn'),
      event('matcher', 'tool', 'check_rules(3 modules)'),
      event('supervisor', 'escalation', 'LOW_CONFIDENCE'),
    ]);
    expect([...seen]).toEqual(expect.arrayContaining(['g3', 'matcher', 'rules', 'supervisor', 'escalation']));
    expect(seen.has('catalogueTools')).toBe(false);
  });
});
