// Staff routes (spec 13). Aggregate views only, with a minimum cohort of five (spec 20.4).
import { DEFAULT_WEIGHTS, MIN_COHORT, schemas, type Insight, type StaffEscalation, type StaffModuleSummary } from '@modulematch/shared';
import { Hono } from 'hono';
import { wordInsight } from '../agents/insights.ts';
import { catalogue, clearExplanationCache, rulesForProfile, setMode, tracerSink } from '../agents/session.ts';
import { rulesFor } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';
import { buildInsights, clashPriorities, cohortStats, type InsightContext } from '../engines/index.ts';
import { createTracer } from '../trace/tracer.ts';
import { body } from './validate.ts';

/** The synthetic cohort plus its programme's home topics, shared by every staff view. */
function insightContext(): InsightContext {
  const cohort = repo.listCohort();
  const first = cohort[0]?.profile;
  const homeTopics = first ? (rulesFor(first.programme, first.yearOfStudy) ?? rulesForProfile(first)).homeTopics : {};
  return {
    modules: catalogue.modules(),
    cohort: cohort.map((s) => s.profile),
    shortlists: cohort.map((s) => s.shortlist),
    weights: DEFAULT_WEIGHTS,
    homeTopics,
    slots: catalogue.slots(),
  };
}

export const staffRoutes = new Hono()
  .get('/modules', (c) => {
    const ctx = insightContext();
    const rows: StaffModuleSummary[] = ctx.modules.flatMap((m) => {
      const stats = cohortStats(m, ctx.cohort, ctx.shortlists, ctx.weights, ctx.homeTopics);
      // Below the minimum cohort nothing is shown for the module (spec 20.4).
      if (!stats) return [];
      return [{ moduleId: m.id, code: m.code, title: m.title, type: m.type, capacity: m.capacity, ...stats }];
    });
    return c.json(rows);
  })
  .get('/modules/:id/insights', async (c) => {
    const ctx = insightContext();
    const module = ctx.modules.find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    const decided = new Map(repo.listInsights(module.id).map((i) => [i.id, i.decision]));
    const cards: Insight[] = await Promise.all(
      buildInsights(module, ctx).map(async (i) => ({ ...(await wordInsight(i)), decision: decided.get(i.id) ?? 'pending' })),
    );
    const current = cards.filter((i) => i.cohortSize >= MIN_COHORT);
    repo.upsertInsights(current);
    // Only cards the current calculation still produces are shown; stored decisions carry over by id.
    const ids = new Set(current.map((i) => i.id));
    return c.json(repo.listInsights(module.id).filter((i) => ids.has(i.id)));
  })
  .post('/insights/:id/decision', body(schemas.InsightDecisionBody), (c) => {
    const insight = repo.setInsightDecision(c.req.param('id'), c.req.valid('json').decision);
    return insight ? c.json(insight) : c.json({ error: 'insight not found' }, 404);
  })
  .put('/modules/:id/derived', body(schemas.DerivedEditBody), (c) => {
    const module = repo.updateModuleDerived(c.req.param('id'), c.req.valid('json'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    clearExplanationCache();
    return c.json(module);
  })
  .get('/timetable/clash-priorities', (c) => {
    const ctx = insightContext();
    // Pairs shared by fewer than five students are withheld (spec 20.4).
    return c.json(clashPriorities(ctx.shortlists, ctx.slots).filter((p) => p.students >= MIN_COHORT));
  })
  .get('/escalations', (c) => {
    const rows: StaffEscalation[] = repo.listEscalations().flatMap((e) => {
      const session = repo.getSession(e.sessionId);
      if (!session) return [];
      return [{ ...e, studentContext: { programme: session.profile.programme, yearOfStudy: session.profile.yearOfStudy, shortlist: session.shortlist } }];
    });
    return c.json(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  })
  .post('/escalations/:id/respond', body(schemas.EscalationRespondBody), (c) => {
    const { response, resolve } = c.req.valid('json');
    const escalation = repo.updateEscalation(c.req.param('id'), { staffResponse: response, status: resolve ? 'resolved' : 'claimed' });
    if (!escalation) return c.json({ error: 'escalation not found' }, 404);
    const session = repo.getSession(escalation.sessionId);
    if (session) {
      const tracer = createTracer(session.id, tracerSink);
      tracer.record({ actor: 'staff', kind: 'escalation', input: escalation.type, output: resolve ? 'staff responded and resolved' : 'staff claimed', verdict: null });
      // The reply returns to the student's session (spec 11.1), and the session leaves ESCALATED.
      repo.addMessage({ id: crypto.randomUUID(), sessionId: session.id, role: 'assistant', agent: 'staff', content: `Reply from staff: ${response}`, at: new Date().toISOString() });
      if (resolve) setMode(session, 'RECOMMEND', tracer, 'staff responded');
    }
    return c.json(escalation);
  });
