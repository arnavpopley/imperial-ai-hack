# ModuleMatch

A personalised module catalogue for Imperial students, built at the Imperial AI Hackathon (14–15 November 2026) for Track 05, the Reply Challenge: AI on Campus.

- **Live demo:** https://modulematch.vercel.app
- **Repo:** https://github.com/arnavpopley/imperial-ai-hack

`MODULE_MATCHER_SPEC.md` is the single source of truth for the build.

## The problem

Students choose modules from a flat catalogue where everyone sees the same description. They pick by rumour and by what friends choose, skip optional modules that would suit them (such as I-Explore), and find timetable clashes only after choosing. Module leads never learn why a module is under-chosen, or what would make it fit more students.

## What it does

### For students

| Feature | What it does |
|---|---|
| Interview | A three-minute adaptive interview builds a profile of interests, goals and learning style. The profile panel fills in live, and every item keeps the student's own words. A pasted CV adds interests and goals after redaction. |
| Cold start | Skip the interview and the catalogue opens in a starter order (the student's year first, electives first), with no fit score claimed until there is something to score. |
| Ranked catalogue | Every module gets a fit score from 0 to 100 with four sub-scores (interest, career goal, learning style, breadth), on one band scale shared with the server: strong 70+, good 50+, partial 35+. Weight sliders show each weight's share of the fit and re-rank instantly. |
| Search and compare | Forgiving search on title, code and topic, and a side-by-side compare of two or three modules. Ineligible modules stay visible, greyed, with the reason. |
| Explanations | Every reason cites the student's quote or a field of the module record. G6 drops anything unsupported, and no reason is given for a topic the student never mentioned. |
| Module page | An AI summary, the reasons it fits, resources, and "Ask about this module", answered from the module's own record and public page. It says plainly when the page cannot answer. |
| Catalogue questions | "Which modules are coursework-only in spring?" or "compare Fluid Mechanics 3A and Computational Continuum Mechanics A", answered by the catalogue agent's deterministic search, lookup and compare tools. |
| Honest answers | "Will this get me a job?" gets a plain answer that nobody can promise that, then what the data does say (pathway relevance and fit). Off-topic questions are steered back. |
| Timetable | A mock week flags certain, likely and possible clashes (provisional slots carry probabilities). Swaps keep fit within 10 points; when none does, wider alternatives show their fit drop. Nothing changes until the student confirms. A plan check shows ECTS progress and real breaks. |
| Capacity | A calm chip marks a capped module near (85%+) or over capacity in the synthetic cohort, and the timetable suggests a backup. Fit is never changed. |
| Export | A printable one-page plan (save as PDF) and an `.ics` calendar of the mock week, both built in the browser. |
| Programme rules | Year-aware. Rules are loaded for MEng Mechanical Engineering Years 3 and 4; for other years ModuleMatch says it cannot confirm rather than inventing rules. The advisor never bends a rule: it offers eligible alternatives and drafts a request the student approves. |
| Societies | The top five societies for the profile, plus one wildcard, from 30 in the public Union listing. |
| Exam results and feedback | From Year 2, with explicit consent, a student can paste a transcript (or upload a PDF or photo when the live models are on). Marks add gentle notes to catalogue modules without changing any fit, and, once an examiner publishes a feedback form, give question-by-question feedback and a revision plan. Withdrawing consent deletes every mark. |

### For staff

| Feature | What it does |
|---|---|
| Senior Tutor decisions | A rule-exception request arrives with the student's reason. **Approve** or **Decline** in one click; an approval waives only the rules that module broke, and the module becomes shortlistable in the student's session. Low-confidence, wellbeing and complaint escalations go to their own queues, and every reply returns to the student. |
| Module leads | Demand against capacity, the fit distribution, and insight cards to accept, note or dismiss. Counterfactual cards say what change would raise fit, and for how many interested students. Staff can correct a module's derived tags. |
| Exam feedback forms | An examiner writes the form for an exam, or has the AI draft it from marking notes. Nothing reaches a student until the examiner publishes it. |
| Timetabling | Clash priorities: students who shortlisted both modules × the chance they clash. |
| Answer feedback | Thumbs up or down on any AI answer, redacted before storage. Staff see totals and recent down-votes, and export JSONL for evaluation. |
| Privacy | Aggregate only. Any count of one to four students is withheld before it leaves the API ("fewer than 5"), and no insight is shown for a group under five. |

### Under the hood

- **Twelve agents** with one job each, and a **"How it works"** page that shows them with their model, tools and the one thing each never does, an animated flowchart of one message, the evaluation results (offline and live) and a live trace of every decision.
- **Design system:** a role type scale (display, title, heading, subheading, body, small, caption) with a 12px floor enforced by a test, one fit-band colour scale, and axe-core checks in the web tests.
- **Code splitting:** the staff console and "How it works" load on demand, so the first load fell from 1,022 kB to 552 kB of JavaScript (#130).

## How it works

**Numbers come from code, words come from models.** Scores, clashes, eligibility, counterfactuals and pathway progress are computed by deterministic TypeScript engines. Agents decide what to ask, call the engines, and explain the results. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the agents, mode machine and guardrail pipeline, and [`docs/EXAMPLES.md`](docs/EXAMPLES.md) for real interactions.

| Piece | Where |
|---|---|
| Supervisor, Interviewer, Profile Extractor, Matcher, Timetabler, Catalogue, module knowledge, results reader, exam feedback, exam form drafter and Insights agents | `server/src/agents` |
| Module Analyst agent (offline batch) | `scripts/analyse-modules.ts` |
| Scoring, rules, timetable, insights, pathway, society, demand, performance, exam-feedback, transcript, privacy and feedback engines | `server/src/engines` |
| Guardrail pipeline (G1–G8) | `server/src/guardrails` |
| Session state, SSE chat and the REST API (Hono) | `server/src/routes` |
| SQLite database (better-sqlite3 and Drizzle) | `server/src/db` |
| Shared zod contracts used by the API and the web app | `packages/shared` |
| React, Vite and Tailwind web app: student app, staff console and the "How it works" page | `web/src` |
| Offline and live evaluation harnesses | `scripts/run-evals.ts`, `scripts/run-live-evals.ts` |

The backend lives in `server/`, not `api/`, because Vercel treats every file in a top-level `api/` folder as a separate function.

## Run it

Requires Node 22.12 or newer.

```sh
npm install
cp .env.example .env   # optional: add ANTHROPIC_API_KEY to switch on the live models
npm run dev            # API on :8790 and web on :5173 (also reachable on your LAN)
```

Open http://localhost:5173. The database seeds itself from `data/` on first start. Choose "Try an example" on the start page to run the journey as Rosa, an invented student whose first answer is already filled in.

| Script | What it does |
|---|---|
| `npm run dev` | API and web together, with reload |
| `npm run seed` | Rebuilds the SQLite database from `data/` |
| `npm test` | Unit, contract and agent tests, run offline (602 server tests and 294 web tests at the time of writing) |
| `npm run eval` | Offline evaluation harness: prints pass rates and stores them for the evaluation page |
| `npm run eval:live` | Live evaluation against the real models (needs `ANTHROPIC_API_KEY`, about $1 a run) |
| `npm run typecheck` | Type-checks every workspace |
| `npm run build` | Builds the web app |
| `npm run deploy:vercel` | Builds the Vercel bundle and deploys it to production (needs `vercel login`) |

**Public demo.** https://modulematch.vercel.app is deployed by Vercel's GitHub integration: every push to `main` deploys to production. Automatic Git deployments are currently switched off (`git.deploymentEnabled: false` in `vercel.json`) because the Hobby plan's 100-deployments-a-day limit was reached; present from `npm run dev`. To turn them back on for `main` only, set it to `{ "**": false, "main": true }`. `vercel.json` also sets the build command to `npm run build:vercel`. Its `"fluid": true` key does not reach a Build Output API function, so Fluid compute (concurrent requests sharing one instance) has to be switched on in the project's Functions settings. `scripts/build-vercel.ts` writes a Build Output API bundle, with the web app as static files and the API as one Node function. The function keeps SQLite in its instance's `/tmp`, seeded from `data/` on each cold start, so sessions last only while the instance is warm. `npm run deploy:vercel` still deploys from your machine. To use live models on the site, add `ANTHROPIC_API_KEY` in the Vercel project settings.

**Offline mode.** Without `ANTHROPIC_API_KEY`, or with `MODULEMATCH_OFFLINE=1`, every agent uses its deterministic path: keyword extraction, templated questions and explanations, the catalogue search results as a list, and pattern-only guardrails. The full journey works this way, and the tests and the offline evaluation always run like this.

**No sign-in.** There is no authentication in this prototype. The staff console sits behind the role switch in the header.

## Models

Model IDs are configuration, set in `.env`.

| Variable | Default | Used for |
|---|---|---|
| `MODEL_SMART` | `claude-opus-5-5` | Interviewer, Matcher explanations and refusals, Catalogue agent (tool loop), module knowledge agent (summaries and Q&A), exam form drafts and tailored exam feedback, Insights wording, Module Analyst |
| `MODEL_FAST` | `claude-sonnet-5-5` (low effort) | Profile and CV extraction, reading uploaded transcript PDFs and photos, and finding sensitive spans for G2 redaction |
| `MODEL_LIGHT` | `claude-haiku-4-5` | Simple classifiers: intent, G1 scope, G3 injection, G4 wellbeing, and timetable wording |
| `MODEL_JUDGE` | `claude-fable-5-1` | The grader in `npm run eval:live` and `npm run benchmark`, stronger than the models it grades |

Calls go through the official Anthropic TypeScript SDK (`@anthropic-ai/sdk`). They use token streaming for the interviewer, tool use for the catalogue agent, structured outputs validated with zod, and prompt caching on system prompts. Sonnet-tier calls use server-side refusal fallbacks. Scoring makes no model calls. Explanations are cached by profile and module, and the top ten are precomputed when recommendations open.

## Libraries

Hono, `@hono/node-server`, `@hono/zod-validator`, zod, `@anthropic-ai/sdk`, better-sqlite3, Drizzle ORM, React, React Router, Motion, DiceBear (interviewer faces), Vite, Tailwind CSS, Vitest and tsx.

## Custom logic

- **Scoring (spec 8).** Interest alignment, goal alignment, learning-style fit with a symmetric penalty for preferences and a one-sided penalty for capabilities, and breadth. The weighted fit renormalises the weights and drops goal when no pathway is chosen. Completeness drives the high, medium and low confidence labels.
- **Timetable (spec 9.2).** Overlap detection, clash probability across provisional candidate slots, swap search, and staff clash priority (students × probability).
- **Insights (spec 9.3).** The interested-but-unconvinced group, counterfactual uplift per candidate change, and overlooked, demand and clash cards. A minimum cohort of five applies to everything, and any count of one to four students is withheld (`server/src/engines/privacy.ts`, spec 20.4).
- **Results and exam feedback (spec 23).** A deterministic transcript parser, topic strengths and informational nudges from consented marks (never touching fit), and exam-feedback facts computed from a published examiner form and the student's question marks. Models only word them.
- **Catalogue search (spec 10.8).** A deterministic keyword and filter search over titles, descriptions, learning outcomes, topics and published assessment. It returns each module with the student's fit and eligibility, so the model never computes either.
- **Guardrails (spec 11).** Scope, redaction, injection and wellbeing checks on input, and schema, grounding, rules and claims checks on output. Every verdict is traced. The same redaction and injection checks clean CV text and feedback comments before storage.

## Datasets

| Dataset | Source | Label |
|---|---|---|
| 60 modules (`data/modules.raw.json`) | Public Imperial module pages: Mechanical Engineering Years 1–4, Business School options and I-Explore. Each module has its source URL | Sample of public descriptions, not an official catalogue |
| Derived module tags (`data/modules.json`) | Module Analyst rules: taxonomy keys only, weights of 0.5 or more must quote the description, short descriptions flagged for review. With no API key during the build, the committed tags were written by hand to those rules; `scripts/analyse-modules.ts` regenerates them with `MODEL_SMART` | Derived, editable by staff |
| Module resources (`data/module-resources.json`) | Links per module (past papers, reading, recordings). Empty for now, so each module page says resources appear once the department publishes them | Sample |
| Taxonomy (`data/taxonomy.json`) | Hand-written: 26 topics and 10 skills | Controlled vocabulary |
| Timetable slots (`data/slots.json`) | `scripts/generate-slots.ts` (seeded), with published I-Explore and Business School times | Synthetic |
| Cohort (`data/cohort.json`) | `scripts/generate-cohort.ts`: 200 profiles across 8 archetypes | Synthetic |
| Programme rules (`data/programme-rules.json`) | Hand-written for MEng Mechanical Engineering, Years 3 and 4 | Illustrative |
| Pathways (`data/pathways.json`) | Hand-written, 8 pathways | Sample |
| Societies (`data/societies.json`) | Public Imperial College Union listing, 30 societies | Sample |
| Evaluation cases (`scripts/eval-cases.ts`, `scripts/eval-hard-cases.ts`) | Hand-written: 12 personas, 4 scripted interviews, and 22 extraction hard cases reviewed from the Adaption stress test | Synthetic |
| Exam feedback forms (`data/exam-forms.json`) | 4 examiner forms written for the demo from each module's public description and learning outcomes | Synthetic, not real exam papers or examiner reports |
| Demo transcript and marking notes (`data/demo/`) | A transcript (text, HTML and PDF) and marking notes for trying the results upload and the AI draft | Synthetic |
| Photos (`web/public/images`) | Pexels, under the Pexels licence; credits in `web/public/images/CREDITS.md` | Stock photos, not Imperial students |

No real student data is used. Grades typed in the chat are redacted and never stored; marks are kept only if a student uploads them with explicit consent (from Year 2), are visible only to them and can be deleted at any time. Health and protected characteristics are never requested, stored or inferred.

## Evaluation

`npm run eval` runs offline and stores the results for the evaluation page. Latest run: `data/eval-latest.json` (15 November 2026).

| Test | Method | Target | Latest |
|---|---|---|---|
| Ranking quality | 12 personas; all three expected modules must appear in the eligible top five | 80% | 10/12 (83%) |
| Extraction | 4 scripted interviews and the natural answers from #55, 47 expected slots | 85% | 47/47 |
| Extraction (hard cases) | Reviewed disagreements from the Adaption stress test, 33 expected slots | 90% | 33/33 |
| Guardrails | 23 adversarial inputs | 100% | 23/23 |
| Determinism | Same profile ranked twice, with the input order reversed | 100% | 2/2 |
| Privacy threshold | Insights requested for a cohort of four | Blocked | Blocked |

The two ranking misses ("startup founder" and "data scientist") each get two of their three expected modules into the top five. They are left visible rather than tuned away.

### Live evaluation

`npm run eval:live` runs the real models (about $1 a run) against cases with known answers and writes `data/eval-live-latest.json`. `npm run eval:live -- --hard-cases` runs only the extraction hard cases and does not overwrite the saved run. Use it to measure prompt and data changes rather than judging them by feel. The committed run is served at `/api/eval/live` and shown on the "How it works" page as "With the live models", with its date, the models it measured and every miss; it is not re-run on a deploy.

| Test | Method | Target | Latest |
|---|---|---|---|
| Module facts | 12 questions generated from published data; answers must quote the exact assessment weightings and prerequisite codes | 90% | 12/12 |
| Module details | 14 questions on published details: lecturers (no contact details), study hours, reading lists and requirements | 90% | 14/14 |
| Declines unknowns | Questions the data cannot answer (lecturer, average mark, failure rate, job guarantee); graded by a model judge | 100% | 4/4 |
| Live extraction | The offline extraction cases (47 slots) through the live extractor | 85% | 46/47 |
| Live extraction (hard cases) | The 33 hard-case slots through the live extractor | 85% | 32/33 |
| Live guardrails | 7 subtle cases for the model classifiers: indirect grade and health disclosures, injection without keywords, distress without keywords | 100% | 7/7 |
| Grounded explanations | Explanations for 5 personas, graded by a model judge that sees everything the Matcher saw | 80% | 5/5 |
| Interview routing | Three mid-interview turns through the real Supervisor: "skip the rest", a job-guarantee question and a catalogue question | 100% | 3/3 |

Models: Opus 5.5 answers and explains, Sonnet 5.5 extracts, Haiku 4.5 runs the simple classifiers, and Fable 5.1 judges. The latest run (15 Nov) cost $0.98. The two misses are left visible: "Building robots and programming the electronics is what I love" was not read as an interest in programming, and "I work part-time on Tuesdays and Thursdays from noon until five" did not keep Tuesdays and Thursdays free.

## Known limits

- The data covers one programme and year in depth (MEng Mechanical Engineering, Year 3), with rules for Years 3 and 4 only. For Years 1 and 2, and for any other programme, ModuleMatch does not invent rules: modules taught in a later year are refused, and every other module is shown as "can't confirm yet", with a note on the catalogue and in onboarding.
- The timetable and cohort are synthetic. Capacities and some terms are assumptions, listed in `data/modules.raw.json`.
- Offline-mode extraction is keyword-based. Live mode is more robust to phrasing.
- The engines treat sessions as independent when combining clash probabilities.
- On Vercel, sessions live in one function instance's `/tmp` and are lost when it goes cold.
- There is no authentication, no real enrolment, and no connection to university systems.

## Documents

- [`docs/LEVEL1.md`](docs/LEVEL1.md): problem, target users, scenario and success metrics.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): inputs, knowledge, tools, decisions and outputs for each agent, with diagrams.
- [`docs/EXAMPLES.md`](docs/EXAMPLES.md): interactions captured from the running API, including the advisor holding its position.
- [`docs/figma/`](docs/figma/): Figma evidence, tokens and Make prompts.
- [`docs/devpost.md`](docs/devpost.md): the Devpost submission text, with the APIs, models and datasets used.
- [`docs/demo-video.md`](docs/demo-video.md): the two-minute demo video script and shot list.
- [`docs/slides.md`](docs/slides.md): the judging deck outline with speaker notes.
- [`docs/reply-criteria.md`](docs/reply-criteria.md): each Reply criterion mapped to a feature, a file and a demo moment.
- [`docs/knowledge-base.md`](docs/knowledge-base.md) (in progress): the module knowledge base.
- [`docs/adaption.md`](docs/adaption.md) (in progress): extraction data expanded with the Adaption API.
- [`docs/ranking-benchmark.md`](docs/ranking-benchmark.md) (in progress): the ranking benchmark.
