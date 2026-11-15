// Keeps the agent roster in step with the code: every agent listed once, grouped by audience, on the model tier
// its source actually passes, with tools that really exist, and with an id the trace can light up.
import { describe, expect, it } from 'vitest';
import { AGENTS, AUDIENCES, countWord, TIERS } from './agents.ts';
import { NODES } from './flow.ts';

const sources = import.meta.glob<string>(['../../../server/src/agents/*.ts', '../../../scripts/analyse-modules.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const source = (path: string) => {
  const text = sources[`../../../${path}`];
  if (text === undefined) throw new Error(`missing source ${path}`);
  return text;
};

/** Where each agent picks its model, and the text that shows the tier it picks. */
const TIER_IN_SOURCE: Record<string, { file: string; pattern: (tier: string) => string }> = {
  supervisor: { file: 'server/src/agents/intent.ts', pattern: (t) => `tier: '${t}'` },
  interviewer: { file: 'server/src/agents/interviewer.ts', pattern: (t) => `tier: '${t}'` },
  extractor: { file: 'server/src/agents/extractor.ts', pattern: (t) => `tier: '${t}'` },
  matcher: { file: 'server/src/agents/matcher.ts', pattern: (t) => `tier: '${t}'` },
  timetabler: { file: 'server/src/agents/timetabler.ts', pattern: (t) => `tier: '${t}'` },
  catalogue: { file: 'server/src/agents/catalogue.ts', pattern: (t) => `modelId('${t}')` },
  knowledge: { file: 'server/src/agents/knowledge.ts', pattern: (t) => `tier: '${t}'` },
  insightsAgent: { file: 'server/src/agents/insights.ts', pattern: (t) => `tier: '${t}'` },
  analyst: { file: 'scripts/analyse-modules.ts', pattern: (t) => `requireEnv('MODEL_${t.toUpperCase()}')` },
};

describe('agent roster', () => {
  it('lists every agent once, in the three audience groups', () => {
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(AGENTS.length);
    const count = (id: string) => AGENTS.filter((a) => a.audience === id).length;
    expect(AUDIENCES.map((a) => a.label)).toEqual(['Student-facing', 'Staff-facing', 'Offline']);
    expect(AUDIENCES.reduce((n, a) => n + count(a.id), 0)).toBe(AGENTS.length);
    expect(AGENTS.map((a) => a.name)).toEqual([
      'Supervisor',
      'Interviewer',
      'Profile Extractor',
      'Matcher',
      'Timetabler',
      'Catalogue',
      'Module knowledge',
      'Insights',
      'Module Analyst',
    ]);
    expect([count('student'), count('staff'), count('offline')]).toEqual([7, 1, 1]);
  });

  it('gives the heading a count word that matches', () => {
    expect(countWord(AGENTS.length)).toBe('Nine');
    expect(countWord(42)).toBe('42');
  });

  it.each(AGENTS.map((a) => [a.name, a] as const))('%s runs on the tier its source passes', (_, agent) => {
    const where = TIER_IN_SOURCE[agent.id];
    expect(where, `no source mapping for ${agent.id}`).toBeDefined();
    expect(source(where!.file)).toContain(where!.pattern(agent.tier));
    expect(TIERS[agent.tier].model).toMatch(/^(Opus|Sonnet|Haiku) /);
  });

  it('only names tools that exist in the code', () => {
    const all = Object.values(sources).join('\n');
    for (const agent of AGENTS) {
      for (const tool of agent.tools.filter((t) => t.includes('_'))) expect(all, `${agent.name}: ${tool}`).toContain(tool);
    }
  });

  it('gives each agent a "never" rule and a short role line', () => {
    for (const agent of AGENTS) {
      expect(agent.never).toMatch(/^[a-z].*\.$/);
      expect(agent.does.split(' ').length).toBeLessThanOrEqual(9);
    }
  });

  it('can light up every agent the trace records', () => {
    const ids = new Set<string>([...NODES.map((n) => n.id), 'knowledge']);
    for (const agent of AGENTS.filter((a) => a.audience !== 'offline')) expect(ids.has(agent.id), agent.id).toBe(true);
  });
});
