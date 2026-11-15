// The eight demo steps from spec 18.2. Each step drives the UI the way the presenter would and asserts what
// the audience should see. Steps share `ctx.state` (the judge's answers, the shortlist, the reply sent).
import { readFileSync } from 'node:fs';
import { sleep } from './cdp.mjs';

const TRANSCRIPT = new URL('../../data/demo/synthetic-transcript.txt', import.meta.url);

/** The judge's answers, chosen by what the interviewer asks so the same script works with live wording. */
const ANSWERS = {
  // States the maths interest outright: the sliders give comfort, not interest, and Mathematics A is the elective
  // the demo swap brings in for Mechatronics 3A.
  love: 'I loved the robotics and control systems lectures, especially the maths and modelling behind them, and anything with machine learning or programming robots.',
  avoid: 'I would avoid heavy thermodynamics and fluid mechanics if I could.',
  career: 'I want to work in robotics or autonomous vehicles after I graduate.',
  assessment: 'I prefer coursework and projects over exams, and I like hands-on applied work.',
  comfort: 'I am fairly comfortable with maths and very comfortable with coding.',
  team: 'I like working in a team, and a fairly heavy workload is fine.',
  breadth: 'Yes, I would like something outside my degree, maybe business.',
  timetable: 'Keep Fridays free if possible.',
  other: 'Mostly robotics and programming, to be honest.',
};
const SLIDER_ANSWER = { maths: 0.7, coding: 0.85 };

/** First match wins, so the more specific topics come first. */
const TOPICS = [
  ['love', /lose track of time|made you lose/i],
  ['avoid', /avoid|rather not|least|dislike|steer clear/i],
  ['timetable', /\bdays?\b|\btimes\b|keep free|mornings?|evenings?/i],
  ['breadth', /outside (your|the) degree|language|business|the arts|other facult|breadth/i],
  ['team', /alone|team|group|workload|heavy/i],
  ['assessment', /exam|coursework|assess/i],
  ['comfort', /maths|math\b|coding|programming-heavy/i],
  ['career', /graduat|career|after (uni|you)|future|industry|kind of role|job/i],
  ['love', /lose track|enjoy|topics?|lectures?|proud|interest/i],
];

export const RULE_BREAK = 'Can I take Nuclear Reactor Physics anyway, even without the prerequisite?';
/** The module the rule-break request names (data/modules.json), and the student's one-line reason for it. */
const RULE_MODULE = 'MECH70002';
const RULE_REASON = 'I covered reactor basics on my summer placement and want to work in nuclear energy.';
/** The Senior Tutor's optional message, sent with Approve exception. */
const STAFF_REPLY = 'Please read the Introduction to Nuclear Energy A notes before week 3.';
/** Two modules the timetable puts at the same time in spring, whatever the profile (data/slots.json). */
const CLASHING = ['MECH60009', 'MECH60018'];
/** Finance & Financial Management: one of the two modules with a counterfactual that clears the bar (+2.1 fit). */
const COUNTERFACTUAL_MODULE = 'BUSI60043';

const CONVERSATION = { css: 'ol[aria-label="Conversation"]' };
const MAIN_NAV = (text) => ({ css: 'nav[aria-label="Role"] a', text });
const STUDENT_TAB = (text) => ({ css: 'nav[aria-label="Student sections"] a', text });
const STAFF_TAB = (text) => ({ css: 'nav[aria-label="Staff sections"] a', text });

const fail = (message) => {
  throw new Error(message);
};

/** Counts the assistant turns in a conversation and reports whether one is still streaming. */
function chatState(scopeCss) {
  const list = document.querySelector(`${scopeCss} ol[aria-label="Conversation"]`);
  const turns = list ? [...list.querySelectorAll(':scope > li[aria-busy]')] : [];
  const last = turns.at(-1);
  const bubble = last?.querySelector('p');
  return {
    count: turns.length,
    busy: turns.some((t) => t.getAttribute('aria-busy') === 'true'),
    text: bubble ? window.__e2e.norm(bubble.innerText) : '',
    error: Boolean(last?.querySelector('[role="alert"]')),
  };
}

/**
 * Sends one chat turn (typed with Enter, or by a submit callback) and waits for the reply to finish,
 * recording time to first token and to the finished reply.
 */
async function chatTurn(ctx, page, scopeCss, label, submit) {
  const before = await page.eval(chatState, scopeCss);
  const started = Date.now();
  await submit();
  let firstTokenMs = null;
  const deadline = started + ctx.timeout;
  for (;;) {
    const now = await page.eval(chatState, scopeCss);
    if (now.count > before.count && now.text && firstTokenMs === null) firstTokenMs = Date.now() - started;
    if (now.count > before.count && !now.busy) {
      if (now.error) fail(`The reply to "${label}" failed: ${now.text || 'error shown in the chat'}`);
      const doneMs = Date.now() - started;
      ctx.latency({ turn: label.slice(0, 60), firstTokenMs, doneMs });
      return now.text;
    }
    if (Date.now() > deadline) fail(`No finished reply to "${label}" within ${ctx.timeout / 1000} s`);
    await sleep(60);
  }
}

/** The student's mode chip (the first one on the page, beside the section tabs) reads `label`. */
function modeIs(label) {
  const chip = [...document.querySelectorAll('main p[aria-live]')].find((p) => p.querySelector(':scope > .sr-only')?.textContent === 'Mode: ');
  return Boolean(chip) && window.__e2e.norm(chip.textContent.replace('Mode:', '')) === label;
}

const pathIs = (page, path, timeout) =>
  page.waitFor((p) => (p instanceof Object ? new RegExp(p.re).test(location.pathname) : location.pathname === p), [path], {
    desc: `the URL to become ${typeof path === 'string' ? path : path.re}`,
    timeout,
  });

/** Ranked catalogue order as module ids, read from the card links. */
const rankedIds = (page) =>
  page.eval(() =>
    [...document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li a[href^="/modules/"]')]
      .filter((a) => a.checkVisibility())
      .map((a) => decodeURIComponent(a.getAttribute('href').slice('/modules/'.length))),
  );

export const STEPS = [
  {
    id: 'interview',
    title: 'Quick interview fills the profile',
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      await page.goto(`${ctx.web}/`);
      const theme = await page.eval(() => document.documentElement.dataset.theme);
      if (theme !== ctx.theme) fail(`Expected the ${ctx.theme} theme from the system setting, got ${theme}`);
      await page.waitForElement({ css: 'a', text: 'Find my modules' });
      await ctx.checkpoint(page, 'landing');
      await page.click({ css: 'a', text: 'Find my modules' });
      await pathIs(page, '/start');
      await page.waitForElement({ css: 'button[type="submit"]', text: 'Start the interview' });
      const form = await page.text({ css: 'form[aria-labelledby="onboard-heading"]' });
      if (!/Year 3/.test(form)) fail('The onboarding form does not default to Year 3');
      await ctx.checkpoint(page, 'onboard');
      await page.click({ css: 'button[type="submit"]', text: 'Start the interview' });
      await pathIs(page, '/interview');
      // The interview opens on the optional results upload (spec 23); the demo skips it.
      const skipResults = { css: 'button', text: 'Skip for now' };
      await page.waitForElement(skipResults, { desc: 'the optional results step' });
      await ctx.checkpoint(page, 'results-step');
      await page.click(skipResults, { desc: 'Skip for now on the results step' });
      const scope = 'section[aria-label="Interview conversation"]';
      await page.waitFor((s) => Boolean(document.querySelector(`${s} ol[aria-label="Conversation"] li[aria-busy="false"] p`)), [scope], {
        desc: 'the first interview question',
      });

      const typed = [];
      const asked = new Map();
      let slidersAnswered = null;
      for (let turn = 0; turn < 14; turn += 1) {
        // Let the previous answer widget finish its exit animation before reading the screen.
        await sleep(450);
        const view = await page.eval(() => ({
          confirm: [...document.querySelectorAll('h3')].some((h) => /Here is what I heard/.test(h.innerText)),
          sliders: Boolean(document.querySelector('form[aria-label="Answer with sliders"]')),
        }));
        if (view.confirm) break;
        const { text: question } = await page.eval(chatState, scope);
        if (view.sliders && question !== slidersAnswered) {
          slidersAnswered = question;
          const slider = (i) => ({ css: 'form[aria-label="Answer with sliders"] input[type="range"]', index: i });
          await page.drag(slider(0), SLIDER_ANSWER.maths, { desc: 'the maths comfort slider' });
          await page.drag(slider(1), SLIDER_ANSWER.coding, { desc: 'the coding comfort slider' });
          await chatTurn(ctx, page, scope, 'sliders', () =>
            page.click({ css: 'form[aria-label="Answer with sliders"] button[type="submit"]', text: 'Send answer' }),
          );
          typed.push('sliders');
          continue;
        }
        const topic = TOPICS.find(([, re]) => re.test(question))?.[0] ?? 'other';
        const times = asked.get(topic) ?? 0;
        asked.set(topic, times + 1);
        const answer = times === 0 ? ANSWERS[topic] : `${ANSWERS.other} ${ANSWERS[topic]}`;
        typed.push(answer);
        await chatTurn(ctx, page, scope, answer, () =>
          page.type({ css: `${scope} textarea` }, answer, { enter: true, desc: 'the interview answer box' }),
        );
        if (turn === 0) await ctx.checkpoint(page, 'interview-first-answer');
      }
      // Everything the judge sent, as it appears in their chat bubbles (slider answers are written out as text).
      ctx.state.typed = await page.eval((s) =>
        [...document.querySelectorAll(`${s} ol[aria-label="Conversation"] > li:not([aria-busy]) p`)].map((p) => window.__e2e.norm(p.innerText)),
      scope);

      await page.waitForElement({ css: 'h3', text: 'Here is what I heard' }, { desc: 'the "Here is what I heard" card' });
      // The live profile shows each item with the quote it came from (spec 14, screen 2).
      if (ctx.viewport === 'phone') await page.click({ css: 'label', text: { re: '^Your profile' } });
      const profile = await page.eval(() => document.querySelector('aside[aria-label="Live profile"]')?.textContent ?? '');
      const quoted = ctx.state.typed.filter((answer) => profile.includes(`You said: ${answer}`) || profile.includes(answer.slice(0, 40)));
      if (quoted.length < 3) fail(`The live profile quotes only ${quoted.length} of the judge's answers`);
      ctx.note(`profile quotes ${quoted.length} of ${ctx.state.typed.length} typed answers`);
      await ctx.checkpoint(page, 'live-profile');
      if (ctx.viewport === 'phone') await page.click({ css: 'label', text: 'Conversation' });
      await page.scrollIntoView({ css: 'h3', text: 'Here is what I heard' });
      await ctx.checkpoint(page, 'what-i-heard');
      await page.click({ css: 'button', text: 'That is me, show my modules' });
      await pathIs(page, '/catalogue');
    },
  },
  {
    id: 'results',
    title: 'Optional: results upload, nudge, feedback, withdraw',
    // Spec 23 is not in the three-minute script, so a failure here is reported but does not stop the demo steps.
    optional: true,
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      const transcript = readFileSync(TRANSCRIPT, 'utf8');
      await page.click(STUDENT_TAB('Your data'));
      await pathIs(page, '/your-data');
      await page.click({ css: 'button', text: 'Add your results' });
      await pathIs(page, '/interview');
      await page.waitForElement({ css: 'h2', text: { exact: 'Your results' } }, { desc: 'the results panel' });
      await page.click({ css: 'label', text: { exact: 'Paste text' } });
      // Pasting: the whole transcript arrives in one input event, as it does from the clipboard.
      await page.type({ forLabel: 'Paste your marks' }, transcript, { desc: 'the marks box' });
      await page.click({ forLabel: 'I agree to share these marks' }, { desc: 'the consent box' });
      await page.click({ css: 'button[type="submit"]', text: 'Read my results' });
      const read = await page.waitFor(
        () => {
          const status = [...document.querySelectorAll('[role="status"]')].map((s) => s.innerText).find((t) => /(Read|Shared) \d+ modules?/.test(t));
          return status ?? false;
        },
        [],
        { desc: 'the marks to be read', timeout: ctx.timeout },
      );
      ctx.note(`results: ${read}`);
      await ctx.checkpoint(page, 'results-read');
      await page.click({ css: 'button', text: 'Back to the conversation' });

      await page.click(STUDENT_TAB('Catalogue'));
      await pathIs(page, '/catalogue');
      const nudge = { css: 'section[aria-labelledby="ranked-heading"] ol > li', text: 'Keep in mind' };
      await page.waitForElement(nudge, { desc: 'a "Keep in mind" note on a catalogue card', timeout: ctx.timeout });
      const nudged = await page.eval(
        () => [...document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li')].filter((li) => li.textContent.includes('Keep in mind')).length,
      );
      ctx.note(`${nudged} catalogue card(s) carry a "Keep in mind" note`);
      await page.scrollIntoView(nudge);
      await ctx.checkpoint(page, 'nudge');

      // The Exam feedback tab appears once there is feedback; the page must render either way.
      const tab = await page.eval(() => [...document.querySelectorAll('nav[aria-label="Student sections"] a')].some((a) => /Exam feedback/.test(a.textContent)));
      if (tab) await page.click(STUDENT_TAB('Exam feedback'));
      else await page.goto(`${ctx.web}/feedback`);
      await pathIs(page, '/feedback');
      await page.waitForElement({ css: 'h1, h2', text: { re: 'exam feedback|feedback' } }, { desc: 'the exam feedback page' });
      const failed = await page.eval(() => document.body.textContent.includes('Your feedback did not load'));
      if (failed) fail('The exam feedback page shows "Your feedback did not load"');
      ctx.note(`feedback page: ${tab ? 'reached from its tab' : 'opened by URL (no tab yet)'}`);
      await ctx.checkpoint(page, 'feedback');

      await page.click(STUDENT_TAB('Your data'));
      await pathIs(page, '/your-data');
      await page.click({ css: 'button', text: 'Withdraw consent and delete my marks' });
      await page.click({ css: 'button', text: 'Yes, delete my marks' });
      await page.waitForElement({ css: '[role="status"]', text: 'Consent withdrawn' }, { desc: 'consent to be withdrawn' });
      await ctx.checkpoint(page, 'withdrawn');
      await page.click(STUDENT_TAB('Catalogue'));
      await pathIs(page, '/catalogue');
      await page.waitFor(() => /\d+ modules · \d+ open to you/.test(document.getElementById('ranked-heading')?.innerText ?? ''), [], {
        desc: 'the ranked catalogue',
      });
      await page.waitFor(
        () => ![...document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li')].some((li) => li.textContent.includes('Keep in mind')),
        [],
        { desc: 'the "Keep in mind" notes to disappear after withdrawing consent' },
      );
      await page.scrollTo('top');
    },
  },
  {
    id: 'catalogue',
    title: 'Ranked catalogue, reasons tied to quotes',
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      await page.waitFor(() => /\d+ modules · \d+ open to you/.test(document.getElementById('ranked-heading')?.innerText ?? ''), [], {
        desc: 'the ranked catalogue',
        timeout: ctx.timeout,
      });
      const ids = await rankedIds(page);
      if (ids.length < 10) fail(`Only ${ids.length} modules are ranked`);
      ctx.state.baseline = ids;
      // Nothing has happened in the advisor yet, so its launcher must not claim new activity.
      const launcher = await page.eval(() => document.querySelector('button[aria-haspopup="dialog"]')?.getAttribute('aria-label'));
      if (launcher !== 'Ask the advisor') fail(`The advisor launcher reads "${launcher}" straight after the interview`);
      await ctx.checkpoint(page, 'catalogue');
      const top = ids[0];
      const title = await page.text({ css: `a[href="/modules/${top}"]` });
      ctx.note(`top module: ${title} (${top})`);
      await page.click({ css: `a[href="/modules/${top}"]` }, { desc: `the top module card (${title})` });
      await pathIs(page, `/modules/${top}`);
      await page.waitForElement({ css: 'ul[aria-label="Reasons"] > li' }, { desc: 'the reasons it fits', timeout: ctx.timeout });

      const count = await page.eval(() => document.querySelectorAll('ul[aria-label="Reasons"] > li').length);
      const quotes = [];
      for (let i = 0; i < count; i += 1) {
        const button = { css: 'ul[aria-label="Reasons"] > li > button', index: i };
        await page.click(button, { desc: `reason ${i + 1}` });
        await sleep(350);
        const quote = await page.eval(
          (n) => document.querySelectorAll('ul[aria-label="Reasons"] > li')[n]?.querySelector('blockquote')?.innerText ?? null,
          i,
        );
        if (quote) quotes.push(quote.replace(/^[“"]|[”"]$/g, '').trim());
        if (quotes.length >= 2) break;
      }
      if (quotes.length === 0) fail('No reason on the top module links back to a quote from the interview');
      const said = ctx.state.typed.join(' \n ').toLowerCase();
      const unmatched = quotes.filter((q) => !said.includes(q.toLowerCase()));
      if (unmatched.length) fail(`A reason quotes words the judge never typed: "${unmatched[0]}"`);
      ctx.note(`${quotes.length} reason(s) quote the judge, e.g. "${quotes[0].slice(0, 60)}"`);
      await ctx.checkpoint(page, 'module-reasons');
      await page.click({ css: 'a', text: 'All modules' });
      await pathIs(page, '/catalogue');
    },
  },
  {
    id: 'weights',
    title: 'Moving a weight slider re-ranks',
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      await page.waitFor(() => document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li a[href^="/modules/"]').length > 5, [], {
        desc: 'the ranked list',
      });
      const before = await rankedIds(page);
      const moved = [];
      let after = before;
      for (const [label, value] of [['Career', 1], ['Learning style', 1], ['Interest', 0]]) {
        const got = await page.drag({ forLabel: { exact: label } }, value, { desc: `the ${label} weight slider` });
        moved.push(`${label} to ${got}`);
        try {
          after = await page.waitFor(
            (b) => {
              const now = [...document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li a[href^="/modules/"]')]
                .filter((a) => a.checkVisibility())
                .map((a) => decodeURIComponent(a.getAttribute('href').slice('/modules/'.length)));
              return now.slice(0, 10).join() !== b.slice(0, 10).join() && now;
            },
            [before],
            { desc: 'the ranking to change', timeout: 2000 },
          );
          break;
        } catch {
          // try the next slider
        }
      }
      if (after === before) fail(`The top ten did not change after moving ${moved.join(', ')}`);
      ctx.note(`moved ${moved.join(', ')}; new top three ${after.slice(0, 3).join(', ')}`);
      const arrows = await page.eval(() => document.body.textContent.includes('places up'));
      if (!arrows) fail('No rank-change arrows appeared');
      await page.waitFor(() => /Saved/.test(document.querySelector('section[aria-labelledby="weights-heading"]')?.innerText ?? ''), [], {
        desc: 'the weights to save',
      });
      await page.scrollTo('top');
      await ctx.checkpoint(page, 'reranked');
      // Back to the default weights, so the clash and swap that follow match the presenter's script.
      await page.click({ css: 'section[aria-labelledby="weights-heading"] button', text: 'Reset' });
      await page.waitFor(
        (b) =>
          [...document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li a[href^="/modules/"]')]
            .filter((a) => a.checkVisibility())
            .map((a) => decodeURIComponent(a.getAttribute('href').slice('/modules/'.length)))
            .slice(0, 10)
            .join() === b.slice(0, 10).join(),
        [before],
        { desc: 'Reset to restore the original ranking' },
      );
      await sleep(700); // the save is debounced by 500 ms; "Saved" from the earlier move is still showing
      await page.waitFor(() => /Saved/.test(document.querySelector('section[aria-labelledby="weights-heading"]')?.innerText ?? ''), [], {
        desc: 'the reset weights to save',
      });
      // Pathways is not in the demo script, but the presenter may open it; check its layout and controls too.
      await page.click(STUDENT_TAB('Pathways'));
      await pathIs(page, '/pathways');
      await page.waitForElement({ css: '#choose-heading' }, { desc: 'the Pathways page' });
      await ctx.checkpoint(page, 'pathways');
      await page.click(STUDENT_TAB('Catalogue'));
      await pathIs(page, '/catalogue');
    },
  },
  {
    id: 'clash',
    title: 'Shortlist three, clash, accept a swap',
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      // A swap must be an elective within 10 fit points of the lower-fit module in the clash (spec 9.2), and the
      // closest candidates rank just below the pair, so the third pick comes from further down to keep them free.
      const eligible = await page.eval(() =>
        [...document.querySelectorAll('section[aria-labelledby="ranked-heading"] ol > li')]
          .filter((li) => li.querySelector('a[href^="/modules/"]') && !li.textContent.includes('Not eligible yet'))
          .map((li) => decodeURIComponent(li.querySelector('a[href^="/modules/"]').getAttribute('href').slice('/modules/'.length))),
      );
      if (!CLASHING.every((id) => eligible.includes(id))) fail(`${CLASHING.join(' and ')} are not both open to this student`);
      const others = eligible.filter((id) => !CLASHING.includes(id));
      const third = others[3] ?? others.at(-1) ?? fail('Not enough eligible modules to shortlist three');
      const picks = [...CLASHING, third];
      for (const id of picks) {
        const button = { css: `section[aria-labelledby="ranked-heading"] ol > li:has(a[href="/modules/${id}"]) button[aria-pressed]` };
        await page.click(button, { desc: `Add to shortlist on ${id}` });
        await page.waitFor((s) => window.__e2e.one(s)?.getAttribute('aria-pressed') === 'true', [button], {
          desc: `${id} to be shortlisted`,
        });
      }
      ctx.state.shortlist = picks;
      await page.waitFor(() => /3 shortlisted/.test(document.querySelector('nav[aria-label="Student sections"]')?.textContent ?? ''), [], {
        desc: 'the Timetable tab to count 3 shortlisted',
      });
      await page.click(STUDENT_TAB('Timetable'));
      await pathIs(page, '/timetable');
      const heading = await page.waitFor(
        () => {
          const h = document.getElementById('clash-heading')?.innerText ?? '';
          return /clash/.test(h) && h;
        },
        [],
        { desc: 'the clash list', timeout: ctx.timeout },
      );
      if (!/1 clash to resolve|\d clashes to resolve/.test(heading)) fail(`Expected a clash, the timetable says "${heading}"`);
      await page.waitForElement({ css: 'section[aria-labelledby="clash-heading"] button', text: { exact: 'Swap' } }, { desc: 'a suggested swap' });
      const suggestion = await page.text({ css: 'section[aria-labelledby="clash-heading"] .rounded-xl', text: 'Replace' });
      ctx.note(`clash: ${heading}; ${suggestion}`);
      await ctx.checkpoint(page, 'clash');
      await page.click({ css: 'section[aria-labelledby="clash-heading"] button', text: { exact: 'Swap' } });
      await page.click({ css: '[aria-label="Confirm swap"] button', text: 'Confirm swap' });
      await page.waitFor(() => document.getElementById('clash-heading')?.innerText === 'No clashes', [], {
        desc: 'the clash to clear after the swap',
        timeout: ctx.timeout,
      });
      const listed = await page.eval(() =>
        // The panel also lists the year's compulsory core modules (#92); the student's own picks have a remove button.
        [...document.querySelectorAll('section[aria-labelledby="shortlist-heading"] li:has(button) a')].map((a) =>
          decodeURIComponent(a.getAttribute('href').slice('/modules/'.length)),
        ),
      );
      if (listed.length !== 3) fail(`After the swap the shortlist has ${listed.length} modules`);
      ctx.state.shortlist = listed;
      await page.scrollTo('top');
      await ctx.checkpoint(page, 'swapped');
    },
  },
  {
    id: 'rule',
    title: 'Rule-break request: holds position, drafts escalation',
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      await page.scrollTo('top'); // the launcher steps aside while a control is under it
      await page.click({ css: 'button[aria-haspopup="dialog"]', label: { re: '^Ask the advisor' } }, { desc: 'the advisor launcher' });
      await page.waitForElement({ css: 'dialog[open] textarea' }, { desc: 'the advisor window' });
      const scope = 'dialog[open]';
      const reply = await chatTurn(ctx, page, scope, RULE_BREAK, () =>
        page.type({ css: 'dialog[open] textarea' }, RULE_BREAK, { enter: true, desc: 'the advisor message box' }),
      );
      if (!/can.?t|cannot|not able|unable|isn.?t open|not open|won.?t/i.test(reply)) fail(`The advisor did not hold its position: "${reply.slice(0, 200)}"`);
      if (!/similar|instead|alternative|you could|consider|you can take|options/i.test(reply)) fail(`The advisor offered no alternatives: "${reply.slice(0, 200)}"`);
      ctx.note(`advisor: "${reply.slice(0, 120)}…"`);
      const send = { css: 'dialog[open] section[aria-label^="Escalation to the"] button[type="submit"]', text: 'Send to the' };
      await page.waitForElement(send, { desc: 'the drafted escalation', timeout: ctx.timeout });
      const draft = await page.eval(() => document.querySelector('dialog[open] section[aria-label^="Escalation to the"] textarea')?.value ?? '');
      if (!/Nuclear Reactor Physics/.test(draft)) fail(`The drafted escalation does not name the module: "${draft.slice(0, 120)}"`);
      // The draft is written for the tutor, about the student, and asks for a one-line reason before it can be sent.
      if (/\b[Yy]ou(r)?\b/.test(draft)) fail(`The drafted escalation speaks to the student, not about them: "${draft.slice(0, 160)}"`);
      const reason = { css: 'dialog[open] section[aria-label^="Escalation to the"] input[type="text"]' };
      await page.waitForElement(reason, { desc: 'the one-line reason box' });
      if (!(await page.eval(() => document.querySelector('dialog[open] section[aria-label^="Escalation to the"] button[type="submit"]')?.disabled))) {
        fail('The escalation can be sent before the student gives a reason');
      }
      await page.type(reason, RULE_REASON, { desc: 'the one-line reason box' });
      await page.scrollIntoView(send);
      await ctx.checkpoint(page, 'held-position');
      await page.click(send, { desc: 'Send to the Senior Tutor' });
      await page.waitFor(
        () => [...document.querySelectorAll('section[aria-label^="Escalation to the"]')].some((s) => /Sent to the|looking at this/.test(s.textContent)),
        [],
        { desc: 'the escalation to show as sent' },
      );
      await page.click({ css: 'dialog[open] header button' }, { desc: 'Close the advisor' });
      await page.waitFor(() => !document.querySelector('dialog[open]'), [], { desc: 'the advisor to close' });
      await page.waitFor(modeIs, ['With a tutor'], { desc: 'the mode chip to read "With a tutor"' });
      const count = await page.eval(() => /(\d+) shortlisted/.exec(document.querySelector('nav[aria-label="Student sections"]')?.textContent ?? '')?.[1]);
      if (count !== '3') fail(`The shortlist changed after the refused request (now ${count ?? 'none'})`);
      await page.scrollTo('top');
      await ctx.checkpoint(page, 'escalation-sent');
    },
  },
  {
    id: 'staff-reply',
    title: 'Staff answer, reply appears for the student',
    async run(ctx) {
      ctx.staff ??= await ctx.openPage('staff');
      const staff = ctx.staff;
      ctx.active = staff;
      await staff.bringToFront();
      await staff.goto(`${ctx.web}/`);
      await staff.click(MAIN_NAV('Staff'), { desc: 'the Staff role switch' });
      await pathIs(staff, { re: '^/staff' });
      await staff.click(STAFF_TAB('Escalations'));
      await pathIs(staff, '/staff/escalations');
      const item = { css: 'a[href^="/staff/escalations/"]', text: 'Nuclear Reactor Physics' };
      await staff.waitForElement(item, { desc: 'the escalation in the queue', timeout: 15_000 });
      await ctx.checkpoint(staff, 'staff-queue');
      await staff.click(item);
      await pathIs(staff, { re: '^/staff/escalations/.+' });
      // The request as data: the broken rule, the student's reason, their fit and completed modules.
      for (const want of ['The request', 'Prerequisite not completed', RULE_REASON, 'Fit for the module', 'Completed modules']) {
        await staff.waitForElement({ css: 'article', text: want }, { desc: `"${want}" in the request details` });
      }
      await staff.type({ css: 'form textarea' }, STAFF_REPLY, {
        desc: 'the optional message to the student',
      });
      await ctx.checkpoint(staff, 'staff-decision');
      await staff.click({ css: 'form button', text: 'Approve exception' });
      await staff.waitForElement({ css: 'h3', text: "Exception approved. The decision is in the student's session" }, { desc: 'the approved state' });
      await ctx.checkpoint(staff, 'staff-resolved');

      // The student's tab has stayed open; the reply should arrive by itself, without a reload.
      const student = ctx.student;
      ctx.active = student;
      await student.bringToFront();
      const arrived = Date.now();
      await student.waitFor(
        (reply) =>
          [...document.querySelectorAll('section[aria-label^="Escalation to the"]')].some(
            (s) => /Exception approved by the Senior Tutor/.test(s.textContent) && s.textContent.includes(reply),
          ),
        [STAFF_REPLY],
        { desc: 'the staff reply in the student session', timeout: 20_000 },
      );
      ctx.note(`reply reached the open student tab ${((Date.now() - arrived) / 1000).toFixed(1)} s after resolving`);
      await student.waitFor(modeIs, ['Recommendations'], { desc: 'the mode chip to return to "Recommendations"' });
      await student.waitFor(() => document.querySelector('button[aria-haspopup="dialog"]')?.getAttribute('aria-label') === 'Ask the advisor, new activity', [], {
        desc: 'the advisor launcher to flag the staff reply as new',
      });
      await student.scrollTo('top');
      await ctx.checkpoint(student, 'reply-in-session');
      // It also lands in the advisor conversation, from "Staff".
      await student.scrollTo('top');
      await student.click({ css: 'button[aria-haspopup="dialog"]', label: { re: '^Ask the advisor' } }, { desc: 'the advisor launcher' });
      await student.waitFor(
        (reply) => [...document.querySelectorAll('dialog[open] ol[aria-label="Conversation"] li')].some((li) => li.textContent.includes(reply)),
        [STAFF_REPLY],
        { desc: 'the staff reply in the advisor chat' },
      );
      await ctx.checkpoint(student, 'reply-in-chat');
      await student.click({ css: 'dialog[open] header button' }, { desc: 'Close the advisor' });
      await student.waitFor(() => !document.querySelector('dialog[open]'), [], { desc: 'the advisor to close' });

      // The approval opens the module: its card says so, and it can now be shortlisted.
      await student.click(STUDENT_TAB('Catalogue'));
      await pathIs(student, '/catalogue');
      const card = { css: `section[aria-labelledby="ranked-heading"] ol > li:has(a[href="/modules/${RULE_MODULE}"])` };
      await student.waitFor(
        (s) => {
          const li = window.__e2e.one(s);
          return Boolean(li && li.textContent.includes('Exception approved by the Senior Tutor') && !li.textContent.includes('Not eligible yet'));
        },
        [card],
        { desc: `${RULE_MODULE} to show the approved exception and be eligible`, timeout: 20_000 },
      );
      const button = { css: `${card.css} button[aria-pressed]` };
      await student.scrollIntoView(card);
      await student.click(button, { desc: `Add to shortlist on ${RULE_MODULE}` });
      await student.waitFor((s) => window.__e2e.one(s)?.getAttribute('aria-pressed') === 'true', [button], {
        desc: `${RULE_MODULE} to be shortlisted`,
      });
      await student.waitFor(() => /4 shortlisted/.test(document.querySelector('nav[aria-label="Student sections"]')?.textContent ?? ''), [], {
        desc: 'the Timetable tab to count 4 shortlisted',
      });
      ctx.state.shortlist = [...(ctx.state.shortlist ?? []), RULE_MODULE];
      await ctx.checkpoint(student, 'exception-shortlisted');
      await student.scrollTo('top');
    },
  },
  {
    id: 'insight',
    title: 'Module-lead dashboard, accept a counterfactual',
    async run(ctx) {
      const staff = ctx.staff ?? fail('No staff tab');
      ctx.active = staff;
      await staff.bringToFront();
      await staff.click(STAFF_TAB('Modules'));
      await pathIs(staff, { re: '^/staff/modules/[^/]+$' });
      // Most modules now get one "no single change makes a big difference" summary; Finance & Financial
      // Management keeps a real counterfactual (+2.1 fit), so the demo opens it.
      await staff.click({ css: `a[href="/staff/modules/${COUNTERFACTUAL_MODULE}"]` }, { desc: `${COUNTERFACTUAL_MODULE} in the module picker` });
      await pathIs(staff, `/staff/modules/${COUNTERFACTUAL_MODULE}`);
      const index = await staff.waitFor(() => {
        const i = [...document.querySelectorAll('article')]
          .filter((a) => a.checkVisibility())
          .findIndex((a) => /counterfactual/i.test(a.innerText) && !/counterfactual summary/i.test(a.innerText) && /\bAccept\b/.test(a.innerText));
        return i >= 0 ? String(i) : false;
      }, [], { desc: 'a counterfactual card (not the summary)', timeout: ctx.timeout });
      const card = { css: 'article', index: Number(index) };
      const headline = await staff.text({ css: 'h3', within: card });
      await ctx.checkpoint(staff, 'dashboard');
      await staff.click({ css: 'button', text: { exact: 'Accept' }, within: card }, { desc: 'Accept on the counterfactual card' });
      // A decided card collapses its actions to "Change decision"; an open one shows Accept pressed. The card is found
      // by its kind, not its headline: the dashboard refetches the cards after a decision, and a counterfactual
      // summary's wording can change then (seen as "the main gap is X" becoming "the main gap is Y").
      const decided = () =>
        [...document.querySelectorAll('article')].some(
          (a) =>
            /Counterfactual/i.test(a.innerText) &&
            /Accepted/.test(a.innerText) &&
            a.innerText.includes('Logged for the module review') &&
            a.innerText.includes('Owner: module lead') &&
            [...a.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Change decision'),
        );
      await staff.waitFor(decided, [], { desc: 'the card to show Accepted' });
      ctx.note(`accepted "${headline}"`);
      await staff.scrollIntoView(card);
      await ctx.checkpoint(staff, 'insight-accepted');
      await staff.reload();
      await staff.waitFor(decided, [], { desc: 'the decision to survive a reload', timeout: ctx.timeout });
    },
  },
  {
    id: 'trace',
    title: 'Trace and evaluation page',
    async run(ctx) {
      const page = ctx.student;
      ctx.active = page;
      await page.bringToFront();
      await page.click(MAIN_NAV({ re: 'How it works|Guide' }), { desc: 'the How it works role switch' });
      await pathIs(page, '/trace');
      await page.waitFor(() => document.querySelectorAll('[aria-label*="percent passed"]').length >= 3, [], {
        desc: 'the evaluation pass rates',
        timeout: ctx.timeout,
      });
      const rates = await page.eval(() => [...document.querySelectorAll('[aria-label*="percent passed"]')].map((e) => e.getAttribute('aria-label')));
      ctx.note(`evaluation: ${rates.join('; ')}`);
      await ctx.checkpoint(page, 'trace-top');
      // The live-model panel's misses hold long one-line reasons: audit the page for overflow with every one open.
      // A boolean, not the element: waitFor returns its value by value, and a DOM node cannot be serialised.
      await page.waitFor(() => Boolean(document.getElementById('live-eval-heading')), [], { desc: 'the live-model evaluation', timeout: ctx.timeout });
      await page.eval(() => {
        for (const d of document.querySelectorAll('section[aria-labelledby="live-eval-heading"] details')) d.open = true;
      });
      await page.scrollIntoView({ css: 'section[aria-labelledby="live-eval-heading"]' });
      await ctx.checkpoint(page, 'trace-live-eval');
      const summary = await page.waitFor(
        () => {
          const t = document.querySelector('ul[aria-label="Summary"]')?.innerText ?? '';
          return /\d+\s*events/.test(t) && t;
        },
        [],
        { desc: 'the live trace for this session', timeout: ctx.timeout },
      );
      const trace = await page.text({ css: 'section[aria-labelledby="trace-heading"]' });
      for (const want of ['Safety check', 'Handed to staff']) {
        if (!trace.includes(want)) fail(`The trace has no "${want}" event`);
      }
      ctx.note(`trace: ${summary.replace(/\s+/g, ' ').slice(0, 160)}`);
      await page.scrollIntoView({ css: 'section[aria-labelledby="trace-heading"]' });
      await ctx.checkpoint(page, 'trace-timeline');
    },
  },
];
