// Shared catalogue, trace and evaluation routes (spec 13).
import { Hono } from 'hono';
import { moduleSummary } from '../agents/knowledge.ts';
import { catalogue, moduleTitle } from '../agents/session.ts';
import { rawModule } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';
import { demandSignals } from '../engines/index.ts';

export const sharedRoutes = new Hono()
  .get('/modules', (c) => c.json(catalogue.modules()))
  // Synthetic cohort demand for near-full and oversubscribed modules, shown to students beside fit (issue #68).
  .get('/modules/demand', (c) => c.json(demandSignals(catalogue.modules(), repo.listCohort().map((s) => s.shortlist))))
  .get('/modules/:id/summary', async (c) => {
    const module = catalogue.modules().find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    return c.json(await moduleSummary(module, rawModule(module.id), moduleTitle));
  })
  .get('/pathways', (c) => c.json(catalogue.pathways()))
  .get('/societies', (c) => c.json(catalogue.societies()))
  .get('/trace/:sessionId', (c) => c.json(repo.listTraceEvents(c.req.param('sessionId'))))
  .get('/eval/latest', (c) => c.json(repo.latestEvalRun()));
