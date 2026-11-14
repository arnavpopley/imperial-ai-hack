import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { benchmarkRoutes } from './routes/benchmark.ts';
import { sharedRoutes } from './routes/shared.ts';
import { staffRoutes } from './routes/staff.ts';
import { studentRoutes } from './routes/student.ts';

export function createApp() {
  const app = new Hono().basePath('/api');
  app.use('*', cors());
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/sessions', studentRoutes);
  app.route('/staff', staffRoutes);
  app.route('/eval', benchmarkRoutes);
  app.route('/', sharedRoutes);
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 500);
  });
  return app;
}

export type App = ReturnType<typeof createApp>;
