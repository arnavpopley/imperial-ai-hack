// Builds a Vercel deployment with the Build Output API (https://vercel.com/docs/build-output-api/v3):
// the web app as static files, and the whole Hono API as one Node function bundled with esbuild.
// Usage: `npm run deploy:vercel` (builds and deploys), or `npx tsx scripts/build-vercel.ts` to build only.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../api/src/db/datasets.ts';

const OUTPUT = resolve(REPO_ROOT, '.vercel/output');
const FUNC = resolve(OUTPUT, 'functions/api.func');
const SQLITE = resolve(REPO_ROOT, 'node_modules/better-sqlite3');

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(FUNC, { recursive: true });

// 1. Web app. The demo flag shows a notice that this public instance uses synthetic students and resets.
execSync('npm run build -w web', { cwd: REPO_ROOT, stdio: 'inherit', env: { ...process.env, VITE_DEMO_INSTANCE: '1' } });
cpSync(resolve(REPO_ROOT, 'web/dist'), resolve(OUTPUT, 'static'), { recursive: true });

// 2. API function. better-sqlite3 is a native module, so it is shipped beside the bundle rather than inlined.
await build({
  entryPoints: [resolve(REPO_ROOT, 'api/src/vercel.ts')],
  outfile: resolve(FUNC, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['better-sqlite3'],
  // Some bundled dependencies are CommonJS and call require(), which an ES module does not define.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'warning',
});
writeFileSync(resolve(FUNC, 'package.json'), JSON.stringify({ type: 'module' }));

// Only the Linux x64 prebuild is needed on Vercel.
const sqliteOut = resolve(FUNC, 'node_modules/better-sqlite3');
cpSync(resolve(SQLITE, 'package.json'), resolve(sqliteOut, 'package.json'));
cpSync(resolve(SQLITE, 'lib'), resolve(sqliteOut, 'lib'), { recursive: true });
cpSync(resolve(SQLITE, 'prebuilds/linux-x64.node'), resolve(sqliteOut, 'prebuilds/linux-x64.node'));

// The datasets the API reads at runtime (modules, slots, cohort, rules, pathways, societies, eval snapshot).
const dataOut = resolve(FUNC, 'data');
mkdirSync(dataOut);
for (const file of readdirSync(resolve(REPO_ROOT, 'data')).filter((f) => f.endsWith('.json'))) {
  cpSync(resolve(REPO_ROOT, 'data', file), resolve(dataOut, file));
}

writeFileSync(
  resolve(FUNC, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      // The chat streams server-sent events.
      supportsResponseStreaming: true,
      maxDuration: 120,
      environment: { DATABASE_PATH: '/tmp/modulematch.db' },
    },
    null,
    2,
  ),
);

// Routes: /api/* goes to the function; everything else is a static file, or the SPA's index.html.
writeFileSync(
  resolve(OUTPUT, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`Built ${OUTPUT}`);
