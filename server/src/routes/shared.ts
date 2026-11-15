// Shared catalogue, trace and evaluation routes (spec 13).
import { Hono } from 'hono';
import { moduleSummary } from '../agents/knowledge.ts';
import { catalogue, moduleTitle } from '../agents/session.ts';
import { programmeInfo, rawModule } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';

export const sharedRoutes = new Hono()
  .get('/modules', (c) => c.json(catalogue.modules()))
  .get('/modules/:id/summary', async (c) => {
    const module = catalogue.modules().find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    return c.json(await moduleSummary(module, rawModule(module.id), moduleTitle));
  })
  .get('/pathways', (c) => c.json(catalogue.pathways()))
  // Which years of each programme have rules loaded, so onboarding can say so before a session exists (issue 51).
  .get('/programmes', (c) => c.json(programmeInfo()))
  .get('/societies', (c) => c.json(catalogue.societies()))
  .get('/trace/:sessionId', (c) => c.json(repo.listTraceEvents(c.req.param('sessionId'))))
  .get('/eval/latest', (c) => c.json(repo.latestEvalRun()));
