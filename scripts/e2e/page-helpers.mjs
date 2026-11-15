// Installed into every page as window.__e2e (serialised with toString, so it must not use outer variables).
//
// A locator ("spec") is plain JSON so it can cross the protocol:
//   { css: 'button', text: 'Send', label: 'Close', within: <spec>, index: 0, forLabel: 'Interest' }
// text and label match case-insensitively as substrings, or as { re, flags } or { exact }. Only visible
// elements match.
export function installHelpers() {
  if (window.__e2e) return;
  const held = new Map();
  let seq = 0;

  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const matches = (value, want) => {
    if (want === undefined || want === null) return true;
    const v = norm(value);
    if (typeof want === 'string') return v.toLowerCase().includes(want.toLowerCase());
    if (want.exact !== undefined) return v === want.exact;
    return new RegExp(want.re, want.flags ?? 'i').test(v);
  };
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return el.checkVisibility({ checkVisibilityCSS: true });
  };

  function all(spec) {
    let scope = document;
    if (spec.within) {
      scope = one(spec.within);
      if (!scope) return [];
    }
    let list;
    if (spec.forLabel) {
      list = [...scope.querySelectorAll('label')]
        .filter((l) => visible(l) && matches(l.innerText, spec.forLabel))
        .map((l) => l.control)
        .filter(Boolean);
    } else {
      list = [...scope.querySelectorAll(spec.css ?? '*')];
    }
    return list.filter(
      (el) =>
        (spec.hidden || visible(el)) &&
        matches(el.innerText ?? el.textContent, spec.text) &&
        matches(el.getAttribute('aria-label'), spec.label),
    );
  }

  function one(spec) {
    return all(spec).at(spec.index ?? 0) ?? null;
  }

  function describe(el) {
    if (!el) return 'nothing';
    const tag = el.tagName.toLowerCase();
    const label = el.getAttribute('aria-label');
    const text = norm(el.innerText).slice(0, 50);
    const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '';
    return `${tag}${el.id ? `#${el.id}` : ''}${label ? `[aria-label="${label}"]` : ''}${text ? ` "${text}"` : cls ? ` .${cls}` : ''}`;
  }

  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const same = (a, b) =>
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

  /** True when nothing else sits on top of `el` at (x, y). */
  function hits(el, top) {
    if (!top) return false;
    if (top === el || el.contains(top)) return true;
    const label = top.closest('label');
    return Boolean(label && (label.control === el || label.contains(el)));
  }

  async function prepare(spec) {
    const el = one(spec);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    let prev = null;
    for (let i = 0; i < 60; i += 1) {
      await frame();
      const r = el.getBoundingClientRect();
      if (prev && same(prev, r)) break;
      prev = r;
    }
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    const ok = hits(el, top);
    seq += 1;
    held.set(seq, el);
    return {
      id: seq,
      x,
      y,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      value: el instanceof HTMLInputElement && el.type === 'range' ? (Number(el.value) - Number(el.min || 0)) / ((Number(el.max || 1) - Number(el.min || 0)) || 1) : null,
      ok,
      coveredBy: ok ? null : describe(top),
      target: describe(el),
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
    };
  }

  function text(spec) {
    const el = one(spec);
    return el ? norm(el.innerText) : null;
  }

  /** Elements wider than the viewport that are not inside a container which clips or scrolls them. */
  function overflow() {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    if (doc.scrollWidth <= vw + 1) return null;
    const offenders = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      // Report the innermost offenders: skip an element whose child also overflows.
      if ([...el.children].some((c) => c.getBoundingClientRect().right > vw + 1)) continue;
      offenders.push(`${describe(el)} (right edge ${Math.round(r.right)}px)`);
      if (offenders.length >= 5) break;
    }
    return { scrollWidth: doc.scrollWidth, viewport: vw, offenders };
  }

  /**
   * The nearest fixed ancestor-or-self, or sticky one that is currently stuck, if any. A sticky element that
   * is taller than its room scrolls like normal content, so it does not count.
   */
  function floating(el) {
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed') return p;
      if (cs.position === 'sticky') {
        const top = parseFloat(cs.top);
        if (Number.isNaN(top) || Math.abs(p.getBoundingClientRect().top - top) < 1) return p;
      }
    }
    return null;
  }

  /** False when (x, y) is outside a scrolling or clipping ancestor, so the control is scrolled out of sight. */
  function insideClips(el, x, y) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = p.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      }
    }
    return true;
  }

  const CLICKABLE =
    'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link]';

  /**
   * Controls whose centre is covered by another element. A floating (fixed or sticky) element that covers an
   * in-flow control only counts where scrolling cannot move the control out from under it: a bottom bar at
   * the bottom of the page, a top bar at the top.
   */
  function overlaps(where) {
    const out = [];
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const modal = [...document.querySelectorAll('dialog')].find((d) => d.open && d.matches(':modal'));
    for (const el of document.querySelectorAll(CLICKABLE)) {
      if (!visible(el) || el.disabled || el.closest('[inert], [aria-hidden="true"]')) continue;
      if (modal && !modal.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      if (!insideClips(el, x, y)) continue;
      const top = document.elementFromPoint(x, y);
      if (!top || hits(el, top) || top.contains(el)) continue;
      const cover = floating(top);
      if (cover && !floating(el)) {
        const box = cover.getBoundingClientRect();
        const pinnedLow = where === 'bottom' && box.top > vh / 2;
        const pinnedHigh = where === 'top' && box.bottom < vh / 2;
        if (!pinnedLow && !pinnedHigh) continue;
      }
      out.push({ where, control: describe(el), coveredBy: describe(top) });
    }
    return out;
  }

  /**
   * Issue #46: scrolls the page from top to bottom and, at each stop, checks every control's centre with
   * elementFromPoint. Any control whose centre lands on the floating advisor launcher is reported, whatever
   * the scroll position. Restores the scroll position afterwards.
   */
  async function launcherSweep() {
    const button = document.querySelector('button[aria-haspopup="dialog"]');
    const launcher = button?.closest('.fixed') ?? button;
    if (!launcher) return [];
    const found = new Map();
    const start = window.scrollY;
    const step = Math.max(160, Math.floor(window.innerHeight * 0.35));
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const vw = document.documentElement.clientWidth;
    for (let y = 0; ; y = Math.min(y + step, max)) {
      window.scrollTo({ top: y, behavior: 'instant' });
      // The launcher re-measures on the next animation frame after a scroll.
      for (let i = 0; i < 3; i += 1) await frame();
      for (const el of document.querySelectorAll(CLICKABLE)) {
        if (launcher.contains(el) || el.disabled || !visible(el)) continue;
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (r.width < 4 || r.height < 4 || x < 0 || cy < 0 || x >= vw || cy >= window.innerHeight) continue;
        if (!insideClips(el, x, cy)) continue;
        const top = document.elementFromPoint(x, cy);
        if (top && launcher.contains(top) && !found.has(el)) found.set(el, `${describe(el)} at scroll ${y}px`);
      }
      if (y >= max) break;
    }
    window.scrollTo({ top: start, behavior: 'instant' });
    await frame();
    return [...found.values()];
  }

  window.__e2e = { one, all, text, describe, prepare, overflow, overlaps, launcherSweep, held: (id) => held.get(id), norm };
}
