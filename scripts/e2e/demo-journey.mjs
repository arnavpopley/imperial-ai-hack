#!/usr/bin/env node
// End-to-end check of the demo script (spec 18.2), driving the real UI in headless Chrome.
//
//   npm run e2e                      offline (MODULEMATCH_OFFLINE=1): deterministic, no API spend
//   npm run e2e -- --live            real models, using the API key in .env (one viewport by default)
//   npm run e2e -- --only=desktop-light,phone-dark
//   npm run e2e -- --headed          watch it run in a visible Chrome window
//   npm run demo:video               the demo video: a visible, slowed-down desktop run to screen-record (docs/demo-video.md)
//   npm run e2e -- --live --until=clash --skip-optional   a cheaper live check of steps 1 to 4
//
// It starts its own API and web server on free ports, with a fresh database per run, and stops every
// process it started (by process group) when it finishes or fails. Screenshots, logs and a results table
// go to scripts/e2e/output/<timestamp>/.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { Cdp, Page, sleep } from './cdp.mjs';
import { STEPS } from './steps.mjs';

/** Demo steps are numbered 1 to 8 as in spec 18.2; optional steps take the number before them plus b, c, …. */
const LABELS = (() => {
  let n = 0;
  let extra = 0;
  return STEPS.map((step) => {
    if (!step.optional) {
      extra = 0;
      return String((n += 1));
    }
    extra += 1;
    return `${n}${String.fromCharCode(97 + extra)}`;
  });
})();

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const LIVE = flag('live');
/**
 * Video mode: one visible desktop window, slowed down for a screen recording, with a hold after each step for the
 * voice-over and a timeline of when each step started (docs/demo-video.md).
 */
const VIDEO = flag('video');
if (VIDEO) {
  process.env.E2E_PACE_MS ??= option('pace') ?? '250';
  process.env.E2E_TYPE_MS ??= option('type-speed') ?? '5';
  process.env.E2E_LANDING_MS ??= option('landing-hold') ?? '7000';
}
const HOLD_MS = Number(option('hold') ?? 1200);
const HEADED = flag('headed') || (VIDEO && !flag('headless'));
/** Stop after the step with this id (for example clash), to keep a live check cheap. */
const UNTIL = option('until');
const SKIP_OPTIONAL = flag('skip-optional');
if (UNTIL && !STEPS.some((s) => s.id === UNTIL)) {
  console.error(`Unknown step "${UNTIL}". Use one of: ${STEPS.map((s) => s.id).join(', ')}`);
  process.exit(2);
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, scale: 1, mobile: false },
  laptop: { width: 1280, height: 720, scale: 1, mobile: false },
  phone: { width: 390, height: 844, scale: 2, mobile: true },
};
const ALL_COMBOS = ['desktop-light', 'desktop-dark', 'laptop-light', 'phone-light', 'phone-dark'];
// Live runs cost money, so they cover one combination unless asked for more.
const combos = (option('only')?.split(',') ?? ((LIVE || VIDEO) && !flag('matrix') ? ['desktop-light'] : ALL_COMBOS)).filter(Boolean);
for (const c of combos) {
  if (!ALL_COMBOS.includes(c)) {
    console.error(`Unknown combination "${c}". Use one of: ${ALL_COMBOS.join(', ')}`);
    process.exit(2);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = resolve(option('out') ?? join(ROOT, 'scripts/e2e/output', `${stamp}${LIVE ? '-live' : ''}`));
mkdirSync(OUT, { recursive: true });
const TMP = mkdtempSync(join(tmpdir(), 'modulematch-e2e-'));

// ---------------------------------------------------------------------------------------------------------
// Processes. Each child runs in its own process group, so stopping the group also stops its helpers
// (esbuild under Vite, renderers under Chrome) without touching anything this script did not start.

/**
 * Every process group this script started and has not yet swept. A child stays here after its main process
 * exits, because helpers in its group may still be running; only stopProcess removes it.
 */
const children = new Set();
/** Every group ever started, for the final check that none is left. */
const startedGroups = [];

function startProcess(name, command, argv, { cwd, env }) {
  const log = createWriteStream(join(OUT, `${name}.log`));
  const child = spawn(command, argv, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.label = name;
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  children.add(child);
  startedGroups.push(child.pid);
  child.once('exit', () => log.end());
  return child;
}

function signalGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function stopProcess(child) {
  const exited = new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  });
  signalGroup(child, 'SIGTERM');
  await Promise.race([exited, sleep(5000)]);
  // Sweep anything left in the group, including helpers that outlived the main process.
  signalGroup(child, 'SIGKILL');
  await Promise.race([exited, sleep(2000)]);
  children.delete(child);
}

let stopping = null;
function stopAll() {
  stopping ??= Promise.all([...children].map(stopProcess));
  return stopping;
}

process.on('exit', () => {
  for (const child of children) signalGroup(child, 'SIGKILL');
  rmSync(TMP, { recursive: true, force: true });
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    console.error(`\nReceived ${signal}; stopping the servers and Chrome.`);
    stopAll().finally(() => process.exit(130));
  });
}
process.on('uncaughtException', (error) => {
  console.error('Unexpected error:', error);
  stopAll().finally(() => process.exit(1));
});
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  stopAll().finally(() => process.exit(1));
});

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, name, child, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`${name} exited early (code ${child.exitCode}); see ${join(OUT, `${child.label}.log`)}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`${name} did not answer at ${url} within ${timeout / 1000} s`);
    await sleep(250);
  }
}

/** The API environment: offline strips any key and sets MODULEMATCH_OFFLINE; live adds .env (never printed). */
function apiEnv(port, databasePath) {
  const env = { ...process.env };
  if (LIVE) {
    const file = join(ROOT, '.env');
    if (!existsSync(file)) throw new Error('--live needs a .env with ANTHROPIC_API_KEY at the repo root.');
    Object.assign(env, parseEnv(readFileSync(file, 'utf8')));
    delete env.MODULEMATCH_OFFLINE;
    if (!env.ANTHROPIC_API_KEY) throw new Error('--live: .env has no ANTHROPIC_API_KEY.');
    env.MODULEMATCH_USAGE_LOG = join(OUT, 'usage.jsonl');
  } else {
    delete env.ANTHROPIC_API_KEY;
    env.MODULEMATCH_OFFLINE = '1';
  }
  // Set last, so a PORT or DATABASE_PATH in .env never points the run at the presenter's own server or data.
  return { ...env, PORT: String(port), DATABASE_PATH: databasePath, NODE_ENV: 'development' };
}

let apiRun = 0;
async function startApi(port) {
  apiRun += 1;
  const child = startProcess(`api-${apiRun}`, process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: join(ROOT, 'server'),
    env: apiEnv(port, join(TMP, `modulematch-${apiRun}.db`)),
  });
  await waitForHttp(`http://127.0.0.1:${port}/api/modules`, 'The API', child);
  return child;
}

async function startWeb(port, apiPort) {
  const child = startProcess('web', process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: join(ROOT, 'web'),
    env: { ...process.env, PORT: String(apiPort), BROWSER: 'none' },
  });
  await waitForHttp(`http://127.0.0.1:${port}/`, 'The web server', child);
  return child;
}

async function startChrome() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
  const profile = join(TMP, 'chrome-profile');
  const child = startProcess(
    'chrome',
    CHROME,
    [
      ...(HEADED ? [] : ['--headless=new']),
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--mute-audio',
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1440,900',
      'about:blank',
    ],
    { cwd: TMP, env: process.env },
  );
  const url = await new Promise((resolveUrl, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not open a DevTools port within 20 s')), 20_000);
    child.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolveUrl(match[1]);
      }
    });
    child.once('exit', () => reject(new Error('Chrome exited before it was ready')));
  });
  return { child, url };
}

// ---------------------------------------------------------------------------------------------------------
// Results. Each step collects its own console errors, failed requests, overflow and overlap findings.

let current = null;

function newStepResult(step) {
  return { id: step.id, title: step.title, status: 'pending', ms: 0, error: null, notes: [], console: [], network: [], overflow: [], overlap: [], screenshots: [], latencies: [] };
}

/** Requests the app cancels on purpose (aborted streams on unmount, superseded fetches) are not failures. */
const isCancel = (msg) => msg.params.canceled || /ERR_ABORTED/.test(msg.params.errorText ?? '');

function onPageEvent(page, msg) {
  const step = current;
  const { method, params } = msg;
  if (method === 'Network.requestWillBeSent') {
    page.requests.set(params.requestId, { url: params.request.url, method: params.request.method });
    return;
  }
  if (!step) return;
  const where = `[${page.name}]`;
  if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'assert')) {
    const text = params.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
    step.console.push(`${where} console.${params.type}: ${text.slice(0, 400)}`);
  } else if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails;
    step.console.push(`${where} uncaught: ${(d.exception?.description ?? d.text).slice(0, 400)}`);
  } else if (method === 'Log.entryAdded' && params.entry.level === 'error' && params.entry.source !== 'network') {
    step.console.push(`${where} ${params.entry.source}: ${params.entry.text.slice(0, 400)}`);
  } else if (method === 'Network.responseReceived' && params.response.status >= 400) {
    const req = page.requests.get(params.requestId);
    step.network.push(`${where} ${req?.method ?? 'GET'} ${new URL(params.response.url).pathname} -> HTTP ${params.response.status}`);
  } else if (method === 'Network.loadingFailed') {
    const req = page.requests.get(params.requestId);
    const url = req ? new URL(req.url) : null;
    const path = url ? url.pathname : params.requestId;
    if (isCancel(msg)) step.notes.push(`${where} cancelled request ${path}`);
    // Third-party assets (the Google Fonts stylesheet) depend on the network, not the app; the page falls
    // back to system fonts, so they are noted rather than failed.
    else if (url && !['127.0.0.1', 'localhost'].includes(url.hostname)) step.notes.push(`${where} external ${url.host}${path} failed: ${params.errorText}`);
    else step.network.push(`${where} ${req?.method ?? 'GET'} ${path} failed: ${params.errorText}`);
  }
}

// ---------------------------------------------------------------------------------------------------------

async function runCombo(cdp, comboName, ports) {
  const [viewportName, theme] = comboName.split('-');
  const viewport = VIEWPORTS[viewportName];
  const dir = join(OUT, comboName);
  mkdirSync(dir, { recursive: true });
  const results = STEPS.map(newStepResult);

  // A fresh database for every combination, so each run starts from the seeded state.
  const api = await startApi(ports.api);
  const { browserContextId } = await cdp.send('Target.createBrowserContext', { disposeOnDetach: true });
  const pages = [];
  const openPage = async (name) => {
    const page = await Page.open(cdp, { browserContextId, name, viewport, theme, onEvent: onPageEvent });
    pages.push(page);
    return page;
  };

  let shot = 0;
  const ctx = {
    web: `http://127.0.0.1:${ports.web}`,
    api: `http://127.0.0.1:${ports.api}/api`,
    live: LIVE,
    viewport: viewportName,
    theme,
    timeout: LIVE ? 120_000 : 20_000,
    state: {},
    student: await openPage('student'),
    staff: null,
    openPage,
    note: (text) => current.notes.push(text),
    latency: (entry) => current.latencies.push(entry),
    /** Screenshot plus overflow and overlap checks for the screen the page is on. */
    async checkpoint(page, label) {
      // Video mode skips the layout checks below: they scroll through the page, which a recording would show as jumps.
      if (!VIDEO) {
        // Issue #46: the advisor launcher must not sit on any control's centre at any scroll position.
        for (const hit of await page.eval(() => window.__e2e.launcherSweep())) {
          current.overlap.push(`${label}: the advisor launcher covers ${hit}`);
        }
        const audit = await page.audit();
        if (audit.overflow) {
          current.overflow.push(`${label}: page is ${audit.overflow.scrollWidth}px wide in a ${audit.overflow.viewport}px viewport; ${audit.overflow.offenders.join('; ') || 'no single element found'}`);
        }
        for (const o of audit.overlaps) current.overlap.push(`${label} (${o.where}): ${o.control} is covered by ${o.coveredBy}`);
      }
      // A screenshot of a visible window briefly blanks it, which a recording shows as a black flash; video mode keeps
      // only the screenshots of failed steps.
      if (VIDEO) return;
      shot += 1;
      const file = `${String(shot).padStart(2, '0')}-${label}.png`;
      await page.screenshot(join(dir, file));
      current.screenshots.push(`${comboName}/${file}`);
    },
  };

  let blocked = null;
  const last = UNTIL ? STEPS.findIndex((s) => s.id === UNTIL) : STEPS.length - 1;
  const videoStart = Date.now();
  const timeline = [];
  const clock = (ms) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  for (const [i, step] of STEPS.entries()) {
    const result = results[i];
    current = result;
    if (i > last || (SKIP_OPTIONAL && step.optional) || (step.videoOnly && !VIDEO)) {
      result.status = 'omitted';
      continue;
    }
    if (blocked) {
      result.status = 'skipped';
      result.error = `skipped: ${blocked} failed`;
      continue;
    }
    const started = Date.now();
    if (VIDEO) timeline.push(`${clock(started - videoStart)}  ${LABELS[i]}. ${step.title}`);
    process.stdout.write(`  ${comboName}  ${LABELS[i]}. ${step.title} ... `);
    try {
      await step.run(ctx);
      // Video mode: let the result sit on screen while the voice-over catches up; the last screen holds longer.
      if (VIDEO) await sleep(i === last ? Math.max(HOLD_MS * 3, 8000) : HOLD_MS);
    } catch (error) {
      result.error = String(error?.message ?? error);
      try {
        const page = ctx.active ?? ctx.student;
        shot += 1;
        const file = `${String(shot).padStart(2, '0')}-FAILED-${step.id}.png`;
        await page.screenshot(join(dir, file));
        result.screenshots.push(`${comboName}/${file}`);
      } catch {
        // the page may be gone
      }
      if (step.optional) {
        // An optional step reports its failure but does not stop the demo steps; put the student back on the catalogue,
        // in front (a background tab gets no animation frames, which the page helpers wait on).
        await ctx.student.bringToFront().catch(() => {});
        await ctx.student.goto(`${ctx.web}/catalogue`).catch(() => {});
      } else {
        blocked = `step ${LABELS[i]}`;
      }
    }
    // Let late console errors and request failures from this step land before scoring it.
    await sleep(300);
    result.ms = Date.now() - started;
    const problems = result.console.length + result.network.length + result.overflow.length + result.overlap.length;
    result.status = result.error ? 'fail' : problems > 0 ? 'issues' : 'pass';
    console.log(`${result.status.toUpperCase()} (${(result.ms / 1000).toFixed(1)} s)${result.error ? `\n      ${result.error}` : ''}`);
    for (const kind of ['console', 'network', 'overflow', 'overlap']) {
      for (const line of [...new Set(result[kind])]) console.log(`      ${kind}: ${line}`);
    }
  }
  current = null;
  if (VIDEO) {
    timeline.push(`${clock(Date.now() - videoStart)}  end`);
    writeFileSync(join(dir, 'video-timeline.txt'), `${timeline.join('\n')}\n`);
    console.log(`\n  Video timeline (from the first step):\n${timeline.map((l) => `    ${l}`).join('\n')}`);
  }

  for (const page of pages) await page.close();
  await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  await stopProcess(api);
  return results;
}

function summarise(all) {
  const lines = [];
  const header = ['Step', ...combos];
  lines.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
  const mark = { pass: 'pass', issues: 'issues', fail: 'FAIL', skipped: 'skipped', omitted: 'not run', pending: '-' };
  STEPS.forEach((step, i) => {
    lines.push(`| ${LABELS[i]}. ${step.title} | ${combos.map((c) => mark[all[c][i].status]).join(' | ')} |`);
  });
  const details = [];
  for (const c of combos) {
    for (const r of all[c]) {
      const items = [
        r.error && `error: ${r.error}`,
        ...[...new Set(r.console)].map((x) => `console: ${x}`),
        ...[...new Set(r.network)].map((x) => `network: ${x}`),
        ...[...new Set(r.overflow)].map((x) => `overflow: ${x}`),
        ...[...new Set(r.overlap)].map((x) => `overlap: ${x}`),
      ].filter(Boolean);
      if (items.length) details.push(`- **${c} / ${r.title}**\n${items.map((x) => `  - ${x}`).join('\n')}`);
    }
  }
  const latencies = combos.flatMap((c) => all[c].flatMap((r) => r.latencies.map((l) => ({ combo: c, step: r.title, ...l }))));
  return { table: lines.join('\n'), details, latencies };
}

function usageSummary() {
  const file = join(OUT, 'usage.jsonl');
  if (!existsSync(file)) return null;
  // USD per million tokens: input, output, cache write (1.25x input), cache read. First matching prefix wins;
  // an unknown model is priced as Opus 5.5 so the estimate errs high.
  const PRICES = {
    'claude-opus-5-5': [4, 20, 5, 0.2],
    'claude-sonnet-5-5': [2, 10, 2.5, 0.2],
    'claude-sonnet-5': [2, 10, 2.5, 0.2],
    'claude-haiku-4-5': [1, 5, 1.25, 0.1],
    'claude-fable-5-1': [10, 50, 12.5, 0.25],
    'claude-opus': [5, 25, 6.25, 0.5],
  };
  let calls = 0;
  let cost = 0;
  const tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const u = JSON.parse(line);
    const price = PRICES[Object.keys(PRICES).find((k) => u.model.startsWith(k)) ?? 'claude-opus-5-5'];
    calls += 1;
    tokens.input += u.input_tokens ?? 0;
    tokens.output += u.output_tokens ?? 0;
    tokens.cacheWrite += u.cache_creation_input_tokens ?? 0;
    tokens.cacheRead += u.cache_read_input_tokens ?? 0;
    cost +=
      ((u.input_tokens ?? 0) * price[0] + (u.output_tokens ?? 0) * price[1] + (u.cache_creation_input_tokens ?? 0) * price[2] + (u.cache_read_input_tokens ?? 0) * price[3]) / 1e6;
  }
  return { calls, tokens, cost };
}

async function main() {
  console.log(`ModuleMatch demo journey: ${LIVE ? 'LIVE models (spends API credit)' : 'offline'}; ${combos.join(', ')}`);
  console.log(`Output: ${OUT}`);
  const ports = { api: await freePort(), web: await freePort() };
  const web = await startWeb(ports.web, ports.api);
  const chrome = await startChrome();
  const cdp = await Cdp.connect(chrome.url);

  const all = {};
  let crashed = null;
  try {
    for (const combo of combos) all[combo] = await runCombo(cdp, combo, ports);
  } catch (error) {
    crashed = error;
    console.error(`\nThe run stopped: ${error?.stack ?? error}`);
  } finally {
    cdp.close();
    await stopProcess(chrome.child);
    await stopProcess(web);
    await stopAll();
  }

  const leftovers = startedGroups.filter((pid) => signalGroup({ pid }, 0));
  if (leftovers.length) console.error(`Warning: process groups still alive: ${leftovers.join(', ')}`);

  for (const c of combos) all[c] ??= STEPS.map((s) => ({ ...newStepResult(s), status: 'skipped', error: 'run stopped' }));
  const summary = summarise(all);
  const usage = usageSummary();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ live: LIVE, combos, results: all, usage }, null, 2));
  const md = [
    `# Demo journey ${LIVE ? '(live)' : '(offline)'}, ${new Date().toISOString()}`,
    '',
    summary.table,
    '',
    summary.details.length ? `## Findings\n\n${summary.details.join('\n')}` : 'No findings.',
    summary.latencies.length
      ? `\n## Chat turn latency\n\n| Combination | Step | Turn | First token | Reply done |\n|---|---|---|---|---|\n${summary.latencies
          .map((l) => `| ${l.combo} | ${l.step} | ${l.turn} | ${l.firstTokenMs ?? '-'} ms | ${l.doneMs} ms |`)
          .join('\n')}`
      : '',
    usage
      ? `\n## API usage\n\n${usage.calls} calls; ${usage.tokens.input} input, ${usage.tokens.output} output, ${usage.tokens.cacheWrite} cache-write and ${usage.tokens.cacheRead} cache-read tokens; about $${usage.cost.toFixed(2)}.`
      : '',
  ].join('\n');
  writeFileSync(join(OUT, 'summary.md'), `${md}\n`);

  console.log(`\n${summary.table}\n`);
  if (usage) console.log(`API usage: ${usage.calls} calls, about $${usage.cost.toFixed(2)}`);
  console.log(`Screenshots and logs: ${OUT}`);
  const failed = crashed || combos.some((c) => all[c].some((r) => r.status !== 'pass' && r.status !== 'omitted'));
  process.exitCode = failed ? 1 : 0;
}

await main();
