# Demo runbook

How to run the live demo at judging (spec 18.2): about three minutes, with a judge playing the student. The recorded video follows its own script in [demo-video.md](demo-video.md); this page is for the live run and what to do when something goes wrong.

## The night before

1. Pull `main` and install: `npm ci`.
2. Run the automated check: `npm run e2e`. It starts its own API and web server on free ports, drives the whole journey below in headless Chrome at 1440×900 and 390×844 in light and dark, and stops everything it started. All 32 cells of the table should say `pass`. Screenshots and logs go to `scripts/e2e/output/<time>/`, and each run writes a `summary.md` there.
3. Run the check once with live models: `npm run e2e -- --live` (one viewport, about $0.50; it reports the spend at the end). Expect interview turns of 5–9 s and about 11 s for the rule-break reply.
4. Record the backup video in offline mode (see [demo-video.md](demo-video.md)), and keep it on the laptop as well as online.

## Pre-flight, 15 minutes before

| Check | How |
|---|---|
| Automated check passes | `npm run e2e -- --only=desktop-light` (about 40 s, no API spend) |
| API key works | `.env` has `ANTHROPIC_API_KEY`, `MODEL_SMART` and `MODEL_FAST`. `npm run dev` prints `Live models: …` on start, not `Offline mode`. |
| Clean database | Stop the server, delete the database (`rm server/modulematch.db*`), and start again with `npm run dev`. On an empty database the server seeds the modules, timetable and cohort and restores the evaluation results for step 8. This clears earlier sessions, escalations and insight decisions. (`npm run seed` alone does not restore the evaluation results.) |
| Browser | Chrome, one window, 1440×900 or larger, zoom 100–110%, light mode, bookmarks bar and notifications off. |
| Tabs | Tab 1: http://localhost:5173 (student). Tab 2: http://localhost:5173/staff/escalations (staff). Tab 3, standby: http://localhost:5173/trace. |
| Fresh student | In tab 1, if a session exists, open **Your data** and delete it, or open all three tabs in one new private window. Keep them in the same window: the How it works page finds the student's session through the browser's storage. |
| Network | Venue wifi plus a phone hotspot. Without internet the app still works offline, but the Inter font falls back to the system font. |

Run locally rather than on https://modulematch.vercel.app: on Vercel each function instance has its own SQLite in `/tmp`, so an escalation sent from one instance may not reach the staff queue on another.

## The clicks

The judge types; you point. Suggested answers are in italics if the judge wants a prompt.

1. **Interview.** Tab 1: **Find my modules**. Leave Year 3 and Quick, click **Start the interview**. The judge answers each question in the box (Enter sends): *"I loved the robotics and control systems lectures, and anything with machine learning or programming robots."* / *"I'd avoid heavy thermodynamics and fluid mechanics."* / *"Robotics or autonomous vehicles."* / *"Coursework and projects, hands-on."* / drag the two sliders and **Send answer** / *"Team work, and a heavy workload is fine."* / *"Maybe something in business."* / *"Keep Fridays free."* Point at **Your profile** on the right as it fills; hover an item to show the quote behind it. On the **Here is what I heard** card, click **That is me, show my modules**. The mode chip changes from Interview to Recommendations.
2. **Catalogue.** Open the top module card. Under **Why it fits you**, click a reason marked **Your words** to show the judge's own quote.
3. **Weights.** **All modules**, then drag **Career** to the right in **What matters most?** The cards re-order at once, with arrows for the moves. Click **Reset**.
4. **Clash and swap.** Shortlist **Embedded C for Microcontrollers A** and **Mechatronics 3A** (usually ranked first and second), plus a third module from further down the list, about fifth or sixth (see the quirks below). Open **Timetable**: one certain clash, Tuesday 14:00 in spring. On the clash card click **Swap**, then **Confirm swap**. The heading changes to **No clashes**.
5. **Rule break.** Click **Ask the advisor** (bottom right). The judge types: *"Can I take Nuclear Reactor Physics anyway, even without the prerequisite?"* The advisor refuses, gives the rule, lists modules the student can take, and drafts a request below. Click **Send to the Senior Tutor**, then close the advisor. The mode chip reads **With a tutor**.
6. **Staff reply.** Tab 2. The queue refreshes every 5 seconds, so the request is already there. Open the request in the queue, type a reply (*"Approved as an exception; read the Introduction to Nuclear Energy A notes before week 3."*) and click **Send reply and resolve**. Back in tab 1, within about 4 seconds and without a reload, **Reply from the Senior Tutor** appears at the top, the mode chip returns to Recommendations, and the advisor button shows a red dot; the reply is also in the advisor chat, from Staff.
7. **Module-lead dashboard.** Tab 2: **Modules**, pick **Mechatronics 3A** in the list. Show demand against capacity, the fit histogram and the **Timetable clash** card, then click **Accept** on a **Counterfactual** card. With live models the insight cards take up to 10 s to load the first time.
8. **Trace and evaluation.** Tab 1: **How it works**. Scroll through the agents and the flowchart to **How we test it** (pass rates against targets) and the **Live trace** for this session: safety checks, the rule block and **Handed to staff**.

## Fallbacks

| What happens | Do this |
|---|---|
| A live reply is slow | Wait. Interview turns take 5–9 s and the rule-break reply about 11 s. Each agent falls back to its template if a call fails or stops early, so the turn still completes. |
| The API key fails or the network is down | Stop the server and run `MODULEMATCH_OFFLINE=1 npm run dev`. Every step works offline, with the fixed question plan and templated explanations. Reload the tabs. |
| The laptop's server will not start | Use https://modulematch.vercel.app for steps 1–5 and 7–8. Step 6 may fail there (separate databases per instance), so narrate it over the video. |
| Anything else | Play the recorded video and narrate over it. |

## Known quirks

- **No swap offered.** A swap must stay within 10 fit points of the module it replaces (spec 9.2). If the third shortlisted module is the only one that close, the card says "No swap keeps your fit within 10 points." In the **Shortlist** panel on the Timetable page, remove the third module (the × button) and shortlist one from further down the catalogue. Picking the third module from about fifth or sixth place avoids this; the automated check does the same.
- **Career slider greyed out.** It needs a pathway in the profile. If the judge's career answer was vague, drag **Learning style** or **Interest** instead.
- **Offline reasons can quote the slider answer.** The offline keyword extractor reads "Coding comfort: 90%." as an interest in programming, so a reason may cite it. Open a different reason. Live extraction does not do this.
- **Counterfactual uplifts are small** (under 3 fit points in the synthetic cohort). Don't promise a big number.
- **The staff dashboard counts up** when it opens; wait a second before reading the numbers aloud.
- **On a phone** the live profile sits behind the **Your profile** tab on the interview screen, and the role switch reads Student, Staff, Guide.

## What the automated check covers

`scripts/e2e/demo-journey.mjs` follows the clicks above with real mouse and keyboard input over the Chrome DevTools protocol (no extra dependencies). At each step it asserts what the audience should see, takes screenshots, and records console errors, failed requests, horizontal overflow and controls covered by another element (for example the advisor button over the last row of a page). It runs with `MODULEMATCH_OFFLINE=1` and a fresh database per viewport unless you pass `--live`.

| Option | Effect |
|---|---|
| `--live` | Real models from `.env`; desktop light only unless `--matrix` |
| `--only=desktop-light,phone-dark` | Run some of the four viewport and theme combinations |
| `--headed` | Show the Chrome window |
| `--out=<dir>` | Where to write screenshots, logs and `summary.md` |

Set `CHROME_PATH` if Chrome is not at `/Applications/Google Chrome.app`.
