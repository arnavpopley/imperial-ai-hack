// Shared catalogue, trace and evaluation routes (spec 13).
import { Hono } from 'hono';
import { catalogue } from '../agents/session.ts';
import * as repo from '../db/repo.ts';

export const sharedRoutes = new Hono()
  .get('/modules', (c) => c.json(catalogue.modules()))
  .get('/pathways', (c) => c.json(catalogue.pathways()))
  .get('/societies', (c) => c.json(catalogue.societies()))
  .get('/trace/:sessionId', (c) => c.json(repo.listTraceEvents(c.req.param('sessionId'))))
  .get('/eval/latest', (c) => c.json(repo.latestEvalRun()));
