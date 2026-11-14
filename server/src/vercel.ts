// Serverless entry for the Vercel deployment (bundled by scripts/build-vercel.ts). The database is SQLite in the
// instance's /tmp, seeded from the bundled data/ on a cold start, so state lasts only while the instance is warm.
import { getRequestListener } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { seedIfEmpty } from './bootstrap.ts';

process.env.MODULEMATCH_DATA_DIR ??= fileURLToPath(new URL('./data', import.meta.url));
process.env.DATABASE_PATH ??= '/tmp/modulematch.db';
seedIfEmpty();

export default getRequestListener(createApp().fetch);
