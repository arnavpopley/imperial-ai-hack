// Shared catalogue, trace and evaluation routes (spec 13). WS0 stubs returning fixtures.
import * as fx from '@modulematch/shared/fixtures';
import { Hono } from 'hono';

export const sharedRoutes = new Hono()
  .get('/modules', (c) => c.json(fx.fixtureModules))
  .get('/pathways', (c) => c.json(fx.fixturePathways))
  .get('/societies', (c) => c.json(fx.fixtureSocieties))
  .get('/trace/:sessionId', (c) => c.json(fx.fixtureTrace))
  .get('/eval/latest', (c) => c.json(fx.fixtureEvalRun));
