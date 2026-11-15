import { SESSION_VERSION_HEADER } from '@modulematch/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import * as repo from './db/repo.ts';
import { isLive } from './agents/llm.ts';
import { cors } from 'hono/cors';
import { benchmarkRoutes } from './routes/benchmark.ts';
import { liveEvalRoutes } from './routes/live-results.ts';
import { resultsRoutes } from './routes/results.ts';
import { sharedRoutes } from './routes/shared.ts';
import { staffRoutes } from './routes/staff.ts';
import { studentRoutes } from './routes/student.ts';

/**
 * Session versions (spec 13). On the public demo each instance keeps its own copy of a session. A request carrying the
 * client's version is refused with 409 "session stale" by an instance whose copy is older, so the client restores it;
 * every response carries this instance's version, so the client always knows the newest one it has seen.
 */
const sessionVersion: MiddlewareHandler = async (c, next) => {
  const id = c.req.param('id');
  const restoring = c.req.path.endsWith('/restore');
  const stored = id ? repo.getSession(id) : null;
  const theirs = c.req.header(SESSION_VERSION_HEADER);
  if (stored && theirs && !restoring && stored.updatedAt < theirs) return c.json({ error: 'session stale' }, 409);
  await next();
  const after = id ? repo.getSession(id)?.updatedAt : undefined;
  if (after) c.res.headers.set(SESSION_VERSION_HEADER, after);
};

export function createApp() {
  const app = new Hono().basePath('/api');
  app.use('*', cors());
  // `live` tells the "How it works" page whether the agents call the models or use their templates (issue #115).
  app.get('/health', (c) => c.json({ ok: true, live: isLive() }));
  app.use('/sessions/:id', sessionVersion);
  app.use('/sessions/:id/*', sessionVersion);
  app.route('/sessions', studentRoutes);
  app.route('/sessions', resultsRoutes);
  app.route('/staff', staffRoutes);
  app.route('/eval', benchmarkRoutes);
  app.route('/eval', liveEvalRoutes);
  app.route('/', sharedRoutes);
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 500);
  });
  return app;
}

export type App = ReturnType<typeof createApp>;
