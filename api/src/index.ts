import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { isLive, modelId } from './agents/llm.ts';
import { seedIfEmpty } from './bootstrap.ts';

if (seedIfEmpty()) console.log('Database was empty, so it was seeded from data/.');
console.log(isLive() ? `Live models: ${modelId('smart')} and ${modelId('fast')}` : 'Offline mode: no ANTHROPIC_API_KEY, agents use their deterministic paths.');

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`ModuleMatch API listening on http://localhost:${info.port}`);
});
