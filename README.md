# ModuleMatch

A personalised module catalogue for Imperial students, built at the Imperial AI Hackathon (14–15 November 2026) for Track 05, the Reply Challenge: AI on Campus.

- **Live demo:** https://modulematch.vercel.app
- **Repo:** https://github.com/arnavpopley/imperial-ai-hack

`MODULE_MATCHER_SPEC.md` is the single source of truth for the build.

## The problem

Students choose modules from a flat catalogue where everyone sees the same description. They pick by rumour and by what friends choose, skip optional modules that would suit them (such as I-Explore), and find timetable clashes only after choosing. Module leads never learn why a module is under-chosen, or what would make it fit more students.

## What it does

- **Interviewer.** A three-minute adaptive interview builds a profile of the student's interests, goals and learning style. The student picks an interviewer face, and the profile panel fills in live. Every item keeps the student's own words as evidence. A student can also paste a CV or personal statement, which is redacted first and then mined for interests and career goals only.
- **Ranked catalogue.** Every module gets a fit score from 0 to 100 with four inspectable sub-scores: interest, career goal, learning style and breadth. What-if sliders re-rank instantly. Ineligible modules stay visible, greyed, with the reason.
- **Explanations.** Every reason cites either the student's own quote or a field of the module record. Unsupported reasons are dropped by a grounding check.
- **Module page.** Each module has an AI summary, the reasons it fits, a resources section, and an "Ask about this module" chat. That chat is answered by the module knowledge agent from the module's own record and public page, and it says plainly when the record cannot answer.
- **Catalogue questions.** The advisor chat answers questions across the whole catalogue, such as "which modules are coursework-only in spring?" or "compare Fluid Mechanics 3A and Computational Continuum Mechanics A". The catalogue agent answers by calling deterministic search, lookup and compare tools.
- **Timetable.** A mock weekly timetable flags certain, likely and possible clashes (provisional slots carry probabilities). It suggests swaps that keep fit within 10 points, and applies a swap only on confirmation.
- **Programme rules.** The advisor refuses to break prerequisites or credit rules, offers eligible alternatives, and drafts an escalation that the student approves.
- **Human in the loop.** Rule exceptions, low-confidence cases, wellbeing concerns and complaints go to staff queues, and staff replies return to the student's session.
- **Staff console.** Module leads see demand against capacity, the fit distribution, and insight cards they can accept, note or dismiss. Counterfactual cards say what change would raise fit, and for how many interested students. Staff can also correct a module's derived tags, and timetabling staff see clash priorities.
- **Answer feedback.** Students can rate any AI answer with a thumbs up or down. The text is redacted before storage. Staff see the totals and recent down-votes, and can export them as JSONL for evaluation.
- **Trace and evaluation.** The "How it works" page shows all twelve agents (student-facing, staff-facing and offline) with their model tier, tools and the one thing each never does, an animated flowchart of one message, the evaluation pass rates and a live trace. Every mode change, agent call, tool call and guardrail verdict is traced. An offline harness and a live-model harness report pass rates.

## How it works

**Numbers come from code, words come from models.** Scores, clashes, eligibility, counterfactuals and pathway progress are computed by deterministic TypeScript engines. Agents decide what to ask, call the engines, and explain the results. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the agents, mode machine and guardrail pipeline, and [`docs/EXAMPLES.md`](docs/EXAMPLES.md) for real interactions.

| Piece | Where |
|---|---|
| Supervisor, Interviewer, Profile Extractor, Matcher, Timetabler, Catalogue, module knowledge, results reader, exam feedback, exam form drafter and Insights agents | `server/src/agents` |
| Module Analyst agent (offline batch) | `scripts/analyse-modules.ts` |
| Scoring, rules, timetable, insights, pathway, society and feedback engines | `server/src/engines` |
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
| `npm test` | Unit, contract and agent tests, run offline (414 server tests and 169 web tests at the time of writing) |
| `npm run eval` | Offline evaluation harness: prints pass rates and stores them for the evaluation page |
| `npm run eval:live` | Live evaluation against the real models (needs `ANTHROPIC_API_KEY`, about $1–2 a run) |
| `npm run typecheck` | Type-checks every workspace |
| `npm run build` | Builds the web app |
| `npm run deploy:vercel` | Builds the Vercel bundle and deploys it to production (needs `vercel login`) |

**Public demo.** https://modulematch.vercel.app is deployed by Vercel's GitHub integration: every push to `main` deploys to production and every pull request gets a preview. `vercel.json` sets the build command to `npm run build:vercel`. `scripts/build-vercel.ts` writes a Build Output API bundle, with the web app as static files and the API as one Node function. The function keeps SQLite in its instance's `/tmp`, seeded from `data/` on each cold start, so sessions last only while the instance is warm. `npm run deploy:vercel` still deploys from your machine. To use live models on the site, add `ANTHROPIC_API_KEY` in the Vercel project settings.

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
- **Insights (spec 9.3).** The interested-but-unconvinced group, counterfactual uplift per candidate change, and overlooked, demand and clash cards. A minimum cohort of five applies to everything.
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
| Evaluation cases (`scripts/eval-cases.ts`) | Hand-written: 12 personas and 4 scripted interviews | Synthetic |
| Photos (`web/public/images`) | Pexels, under the Pexels licence; credits in `web/public/images/CREDITS.md` | Stock photos, not Imperial students |

No real student data is used. No grades, results or protected characteristics are requested, stored or inferred.

## Evaluation

`npm run eval` runs offline and stores the results for the evaluation page. Latest run: `data/eval-latest.json`.

| Test | Method | Target | Latest |
|---|---|---|---|
| Ranking quality | 12 personas; all three expected modules must appear in the eligible top five | 80% | 10/12 (83%) |
| Extraction | 4 scripted interviews, 33 expected slots | 85% | 33/33 |
| Guardrails | 15 adversarial inputs | 100% | 15/15 |
| Determinism | Same profile ranked twice, with the input order reversed | 100% | 2/2 |
| Privacy threshold | Insights requested for a cohort of four | Blocked | Blocked |

The two ranking misses ("startup founder" and "data scientist") each get two of their three expected modules into the top five. They are left visible rather than tuned away.

### Live evaluation

`npm run eval:live` runs the real models (about $1–2 a run) against cases with known answers and writes `data/eval-live-latest.json`. Use it to measure prompt and data changes rather than judging them by feel. The committed run is served at `/api/eval/live` and shown on the "How it works" page as "With the live models", with its date, the models it measured and every miss; it is not re-run on a deploy.

| Test | Method | Target | Latest |
|---|---|---|---|
| Module facts | 12 questions generated from published data; answers must quote the exact assessment weightings and prerequisite codes | 90% | 11/12 |
| Declines unknowns | Questions the data cannot answer (lecturer, average mark, failure rate, job guarantee); graded by a model judge | 100% | 4/4 |
| Live extraction | The 4 scripted interviews through the live extractor | 85% | 33/33 |
| Live guardrails | 7 subtle cases for the model classifiers: indirect grade and health disclosures, injection without keywords, distress without keywords | 100% | 7/7 |
| Grounded explanations | Explanations for 5 personas, graded by a model judge that sees everything the Matcher saw | 80% | 4/5 |

Models: Opus 5.5 answers and explains, Sonnet 5.5 extracts, Haiku 4.5 runs the simple classifiers, and Fable 5.1 judges. The misses: one assessment answer said "a weighting of 1" instead of "100%", and the judge failed one explanation (Mathematics A) for over-interpreting the breadth sub-score and assuming "no coursework".

## Known limits

- The data covers one programme and year in depth (MEng Mechanical Engineering, Year 3). Other programmes get permissive placeholder rules.
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
