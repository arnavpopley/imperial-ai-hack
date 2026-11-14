// Staff routes (spec 13). WS0 stubs returning fixtures.
import { schemas } from '@modulematch/shared';
import * as fx from '@modulematch/shared/fixtures';
import { Hono } from 'hono';
import { body } from './validate.ts';

export const staffRoutes = new Hono()
  .get('/modules', (c) => c.json(fx.fixtureStaffModules))
  .get('/modules/:id/insights', (c) => c.json(fx.fixtureInsights))
  .post('/insights/:id/decision', body(schemas.InsightDecisionBody), (c) =>
    c.json({ ...fx.fixtureInsights[0]!, decision: c.req.valid('json').decision }),
  )
  .put('/modules/:id/derived', body(schemas.DerivedEditBody), (c) =>
    c.json({ ...fx.fixtureModules[0]!, derivedBy: 'staff-edit' }),
  )
  .get('/timetable/clash-priorities', (c) => c.json(fx.fixtureClashPriorities))
  .get('/escalations', (c) => c.json(fx.fixtureStaffEscalations))
  .post('/escalations/:id/respond', body(schemas.EscalationRespondBody), (c) =>
    c.json({ ...fx.fixtureEscalation, status: 'resolved', staffResponse: c.req.valid('json').response }),
  );
