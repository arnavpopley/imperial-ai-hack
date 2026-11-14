// Student routes (spec 13). WS0 stubs: every route validates its body and returns a fixture.
import { schemas } from '@modulematch/shared';
import * as fx from '@modulematch/shared/fixtures';
import type { SseEvent } from '@modulematch/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { body } from './validate.ts';

export const studentRoutes = new Hono()
  .post('/', body(schemas.CreateSessionBody), (c) => c.json(fx.fixtureSession, 201))
  .get('/:id', (c) => c.json(fx.fixtureSession))
  .post('/:id/messages', body(schemas.SendMessageBody), (c) =>
    streamSSE(c, async (stream) => {
      const events: SseEvent[] = [
        { type: 'guardrail', stage: 'G1 scope', verdict: 'pass', notice: null },
        { type: 'token', text: 'Thanks. ', agent: 'interviewer' },
        { type: 'token', text: 'What would you avoid if you could?', agent: 'interviewer' },
        { type: 'profile_update', profile: fx.fixtureProfile, evidence: fx.fixtureEvidence },
        { type: 'done', messageId: 'm-fixture', widget: null },
      ];
      for (const event of events) await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    }),
  )
  .put('/:id/profile', body(schemas.ProfileEditBody), (c) => c.json(fx.fixtureSession))
  .delete('/:id/profile', (c) => c.json(fx.fixtureSession))
  .put('/:id/weights', body(schemas.Weights), (c) => c.json(fx.fixtureRecommendations))
  .get('/:id/recommendations', (c) => c.json(fx.fixtureRecommendations))
  .get('/:id/modules/:moduleId/explanation', (c) =>
    c.json({ explanation: fx.fixtureExplanation, evidence: fx.fixtureEvidence }),
  )
  .post('/:id/shortlist', body(schemas.ShortlistBody), (c) => c.json(fx.fixtureSession))
  .get('/:id/timetable', (c) => c.json(fx.fixtureTimetable))
  .post('/:id/escalations', body(schemas.CreateEscalationBody), (c) => c.json(fx.fixtureEscalation, 201))
  .get('/:id/pathways/:pathwayId/progress', (c) => c.json(fx.fixturePathwayProgress))
  .get('/:id/societies', (c) => c.json(fx.fixtureSocietyMatches));
