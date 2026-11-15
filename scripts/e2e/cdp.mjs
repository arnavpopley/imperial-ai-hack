// A small Chrome DevTools Protocol client over Node's built-in WebSocket, plus a Page wrapper that clicks,
// types and drags with real input events. No Playwright or Puppeteer: the demo check stays dependency-free.
import { writeFileSync } from 'node:fs';
import { installHelpers } from './page-helpers.mjs';

const SEND_TIMEOUT_MS = 60_000;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Cdp {
  #ws;
  #seq = 0;
  #pending = new Map();
  #listeners = new Set();

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`Could not connect to Chrome at ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id !== undefined) {
        const pending = this.#pending.get(msg.id);
        if (!pending) return;
        this.#pending.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.error) pending.reject(new Error(`${pending.method}: ${msg.error.message}`));
        else pending.resolve(msg.result);
      } else {
        for (const listener of this.#listeners) listener(msg);
      }
    });
    ws.addEventListener('close', () => {
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`${pending.method}: the browser connection closed`));
      }
      this.#pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    const id = (this.#seq += 1);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method}: no reply from Chrome within ${SEND_TIMEOUT_MS / 1000} s`));
      }, SEND_TIMEOUT_MS);
      this.#pending.set(id, { resolve, reject, method, timer });
      this.#ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  close() {
    this.#ws.close();
  }
}

/**
 * Serialises an in-page call: `fn` runs in the page with JSON arguments. A DOM node cannot cross the protocol by
 * value, so a returned node (for example from a waitFor on querySelector) comes back as true.
 */
const call = (fn, args) => `Promise.resolve((${fn})(...${JSON.stringify(args)})).then((v) => (v instanceof Node ? true : v))`;

export class Page {
  /**
   * @param {Cdp} cdp
   * @param {{ sessionId: string, targetId: string, name: string, onEvent: (page: Page, msg: object) => void }} opts
   */
  constructor(cdp, { sessionId, targetId, name, onEvent }) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.name = name;
    this.requests = new Map();
    this.off = cdp.on((msg) => {
      if (msg.sessionId === sessionId) onEvent(this, msg);
    });
  }

  static async open(cdp, { browserContextId, name, viewport, theme, onEvent }) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(cdp, { sessionId, targetId, name, onEvent });
    await Promise.all([
      page.send('Page.enable'),
      page.send('Runtime.enable'),
      page.send('Network.enable'),
      page.send('Log.enable'),
    ]);
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.scale,
      mobile: viewport.mobile,
    });
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: theme }],
    });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installHelpers})()` });
    return page;
  }

  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor(() => document.readyState === 'complete' && Boolean(window.__e2e), [], {
      desc: `${url} to load`,
      timeout: 30_000,
    });
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: false });
    await sleep(300);
    await this.waitFor(() => document.readyState === 'complete' && Boolean(window.__e2e), [], { desc: 'the page to reload' });
  }

  async bringToFront() {
    await this.send('Page.bringToFront');
  }

  /** Runs `fn(...args)` in the page and returns its JSON result. */
  async eval(fn, ...args) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression: call(fn, args),
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (exceptionDetails) {
      throw new Error(`In-page error: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    return result.value;
  }

  /** Polls `fn(...args)` until it returns something truthy. */
  async waitFor(fn, args = [], { timeout = 15_000, interval = 100, desc = 'a condition' } = {}) {
    const deadline = Date.now() + timeout;
    let last;
    for (;;) {
      try {
        last = await this.eval(fn, ...args);
        if (last) return last;
      } catch (error) {
        // A navigation can destroy the execution context mid-poll; keep polling until the deadline.
        if (!/context|navigat|Cannot find|__e2e/i.test(String(error))) throw error;
      }
      if (Date.now() > deadline) throw new Error(`Timed out after ${timeout / 1000} s waiting for ${desc}`);
      await sleep(interval);
    }
  }

  /** Waits until an element matching `spec` exists and is visible, and returns its description. */
  waitForElement(spec, opts = {}) {
    return this.waitFor((s) => window.__e2e.describe(window.__e2e.one(s)) !== 'nothing' && window.__e2e.describe(window.__e2e.one(s)), [spec], {
      desc: opts.desc ?? `element ${JSON.stringify(spec)}`,
      ...opts,
    });
  }

  text(spec) {
    return this.eval((s) => window.__e2e.text(s), spec);
  }

  /**
   * Scrolls the element into view, waits for it to stop moving and to be enabled, checks nothing covers its
   * centre, then clicks there with real mouse events. A covered control fails the click, because a person
   * could not click it either.
   */
  async click(spec, { desc, timeout = 15_000 } = {}) {
    const info = await this.prepare(spec, { desc, timeout });
    await this.mouseClick(info.x, info.y);
    return info;
  }

  /** Finds a visible, enabled, uncovered element, scrolled into view, and returns its centre and rect. */
  async prepare(spec, { desc, timeout = 15_000 } = {}) {
    const name = desc ?? JSON.stringify(spec);
    const deadline = Date.now() + timeout;
    for (;;) {
      const info = await this.eval((s) => window.__e2e.prepare(s), spec).catch(() => null);
      if (info && info.ok && !info.disabled) return info;
      if (Date.now() > deadline) {
        if (!info) throw new Error(`Could not find ${name}`);
        if (info.disabled) throw new Error(`${name} stayed disabled`);
        throw new Error(`${name} (${info.target}) is covered by ${info.coveredBy}, so it cannot be clicked`);
      }
      await sleep(150);
    }
  }

  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }

  /** Clicks a text field, types into it like a keyboard would, and optionally presses Enter. */
  async type(spec, text, { enter = false, desc } = {}) {
    await this.click(spec, { desc });
    await this.send('Input.insertText', { text });
    if (enter) await this.press('Enter');
  }

  async press(key) {
    const codes = { Enter: 13, Escape: 27, Tab: 9 };
    const base = { key, code: key, windowsVirtualKeyCode: codes[key], nativeVirtualKeyCode: codes[key] };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(key === 'Enter' ? { text: '\r' } : {}) });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  /** Drags a range input's thumb from its current value to `fraction` of the track, and returns the new value. */
  async drag(spec, fraction, { desc } = {}) {
    const info = await this.prepare(spec, { desc });
    const { left, width, top, height } = info.rect;
    const y = top + height / 2;
    const at = (f) => left + Math.min(Math.max(f, 0), 1) * width;
    const from = at(info.value ?? 0.5);
    // Past either end clamps to the end, as it does for a person dragging off the track.
    const to = fraction >= 1 ? left + width + 8 : fraction <= 0 ? left - 8 : at(fraction);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from, y, button: 'left', buttons: 1, clickCount: 1 });
    const steps = 10;
    for (let i = 1; i <= steps; i += 1) {
      const x = from + ((to - from) * i) / steps;
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
      await sleep(16);
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to, y, button: 'left', buttons: 0, clickCount: 1 });
    return this.eval((id) => Number(window.__e2e.held(id)?.value), info.id);
  }

  async scrollTo(where) {
    await this.eval((w) => {
      window.scrollTo({ top: w === 'bottom' ? document.documentElement.scrollHeight : 0, behavior: 'instant' });
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, where);
  }

  async scrollIntoView(spec) {
    await this.eval((s) => {
      window.__e2e.one(s)?.scrollIntoView({ block: 'center', behavior: 'instant' });
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, spec);
  }

  async screenshot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(data, 'base64'));
  }

  /** Horizontal overflow, plus controls covered by something else at the top, the bottom and the current scroll. */
  async audit() {
    const scrollY = await this.eval(() => window.scrollY);
    const overflow = await this.eval(() => window.__e2e.overflow());
    const overlaps = [...(await this.eval(() => window.__e2e.overlaps('here')))];
    const scrollable = await this.eval(() => document.documentElement.scrollHeight > window.innerHeight + 1);
    if (scrollable) {
      for (const where of ['top', 'bottom']) {
        await this.scrollTo(where);
        overlaps.push(...(await this.eval((w) => window.__e2e.overlaps(w), where)));
      }
      await this.eval((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
    }
    const seen = new Set();
    const unique = overlaps.filter((o) => {
      const key = `${o.control} | ${o.coveredBy}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { overflow, overlaps: unique };
  }

  async close() {
    this.off();
    await this.cdp.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}
