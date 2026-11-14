a # ModuleMatch

A personalised module catalogue for Imperial students, built at the Imperial AI Hackathon (14–15 November 2026) for Track 05, the Reply Challenge: AI on Campus.

`MODULE_MATCHER_SPEC.md` is the single source of truth for the build.

## The problem

Students choose modules from a flat catalogue where everyone sees the same description. They pick by rumour and by what friends choose, skip optional modules that would suit them (such as I-Explore), and find timetable clashes only after choosing. Module leads never learn why a module is under-chosen, or what would make it fit more students.

## What it does

- **Interviewer.** A three-minute adaptive interview builds a profile of the student's interests, goals and learning style. The profile panel fills in live, and every item keeps the student's own words as evidence.
- **Ranked catalogue.** Every module gets a fit score from 0 to 100 with four inspectable sub-scores: interest, career goal, learning style and breadth. What-if sliders re-rank instantly. Ineligible modules stay visible, greyed, with the reason.
- **Explanations.** Every reason cites either the student's own quote or a field of the module record. Unsupported reasons are dropped by a grounding check.
- **Timetable.** A mock weekly timetable flags certain, likely and possible clashes (provisional slots carry probabilities). It suggests swaps that keep fit within 10 points, and applies a swap only on confirmation.
- **Programme rules.** The advisor refuses to break prerequisites or credit rules, offers eligible alternatives, and drafts an escalation that the student approves.
- **Human in the loop.** Rule exceptions, low-confidence cases, wellbeing concerns and complaints go to staff queues, and staff replies return to the student's session.
- **Staff console.** Module leads see demand against capacity, the fit distribution, and insight cards they can accept, note or dismiss. Counterfactual cards say what change would raise fit, and for how many interested students. Staff can also correct a module's derived tags, and timetabling staff see clash priorities.
- **Trace and evaluation.** Every mode change, agent call, tool call and guardrail verdict is traced. An evaluation harness reports pass rates.

## How it works

**Numbers come from code, words come from models.** Scores, clashes, eligibility, counterfactuals and pathway progress are computed by deterministic TypeScript engines. Agents decide what to ask, call the engines, and explain the results. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the agents, mode machine and guardrail pipeline, and [`docs/EXAMPLES.md`](docs/EXAMPLES.md) for real interactions.

| Piece | Where |
|---|---|
| Supervisor, Interviewer, Profile Extractor, Matcher, Timetabler and Insights agents | `api/src/agents` |
| Module Analyst agent (offline batch) | `scripts/analyse-modules.ts` |
| Scoring, rules, timetable, insights, pathway and society engines | `api/src/engines` |
| Guardrail pipeline (G1–G8) | `api/src/guardrails` |
| Session state, SSE chat and the REST API (Hono) | `api/src/routes` |
| SQLite database (better-sqlite3 and Drizzle) | `api/src/db` |
| Shared zod contracts used by the API and the web app | `packages/shared` |
| React, Vite and Tailwind web app | `web/src` |

## Run it

Requires Node 22.12 or newer.

```sh
npm install
cp .env.example .env   # optional: add ANTHROPIC_API_KEY to switch on the live models
npm run dev            # API on :8790 and web on :5173 (also reachable on your LAN)
```

Open http://localhost:5173. The database seeds itself from `data/` on first start.

| Script | What it does |
|---|---|
| `npm run dev` | API and web together, with reload |
| `npm run seed` | Rebuilds the SQLite database from `data/` |
| `npm test` | Unit, contract and agent tests, run offline |
| `npm run eval` | Evaluation harness: prints pass rates and stores them for the evaluation page |
| `npm run typecheck` | Type-checks every workspace |
| `npm run build` | Builds the web app |
| `npm run deploy:vercel` | Builds the Vercel bundle and deploys it to production (needs `vercel login`) |

**Public demo.** https://modulematch.vercel.app runs the same app on Vercel. Every merge to `main` deploys it through `.github/workflows/deploy.yml`, which needs a `VERCEL_TOKEN` secret and `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` repository variables. `npm run deploy:vercel` deploys from your machine. Vercel's own git builds are off in `vercel.json`, because they would turn every file under `api/` into a separate function. Either way: `scripts/build-vercel.ts` writes a Build Output API bundle, with the web app as static files and the API as one Node function. The function keeps SQLite in its instance's `/tmp`, seeded from `data/` on each cold start, so sessions last only while the instance is warm. The live demo for judging runs locally. To use live models there, add `ANTHROPIC_API_KEY` in the Vercel project settings and redeploy.

**Offline mode.** Without `ANTHROPIC_API_KEY`, or with `MODULEMATCH_OFFLINE=1`, every agent uses its deterministic path: keyword extraction, templated questions and explanations, and pattern-only guardrails. The full journey works this way, and the tests and evaluations always run like this.

**No sign-in.** There is no authentication in this prototype. The staff console sits behind the role switch in the header.

## Models

Model IDs are configuration, set in `.env`.

| Variable | Default | Used for |
|---|---|---|
| `MODEL_SMART` | `claude-sonnet-5-5` | Interviewer, Matcher explanations, Module Analyst, Insights wording |
| `MODEL_FAST` | `claude-haiku-4-5` | Intent classification, profile extraction, guardrail classifiers, timetable wording |

Calls go through the official Anthropic TypeScript SDK (`@anthropic-ai/sdk`). They use streaming for the interviewer, structured outputs validated with zod, and prompt caching on system prompts. Sonnet-tier calls use server-side refusal fallbacks. Scoring makes no model calls, and explanations are cached by profile hash and module ID.

## Libraries

Hono, `@hono/node-server`, `@hono/zod-validator`, zod, better-sqlite3, Drizzle ORM, React, React Router, Vite, Tailwind CSS, Vitest and tsx.

## Custom logic

- **Scoring (spec 8).** Interest alignment, goal alignment, learning-style fit with a symmetric penalty for preferences and a one-sided penalty for capabilities, and breadth. The weighted fit renormalises the weights and drops goal when no pathway is chosen. Completeness drives the high, medium and low confidence labels.
- **Timetable (spec 9.2).** Overlap detection, clash probability across provisional candidate slots, swap search, and staff clash priority (students × probability).
- **Insights (spec 9.3).** The interested-but-unconvinced group, counterfactual uplift per candidate change, and overlooked, demand and clash cards. A minimum cohort of five applies to everything.
- **Guardrails (spec 11).** Scope, redaction, injection and wellbeing checks on input, and schema, grounding, rules and claims checks on output. Every verdict is traced.

## Datasets

| Dataset | Source | Label |
|---|---|---|
| 60 modules (`data/modules.raw.json`) | Public Imperial module pages: Mechanical Engineering Years 1–4, Business School options and I-Explore. Each module has its source URL | Sample of public descriptions, not an official catalogue |
| Derived module tags (`data/modules.json`) | Module Analyst rules: taxonomy keys only, weights of 0.5 or more must quote the description, short descriptions flagged for review. With no API key during the build, the committed tags were written by hand to those rules; `scripts/analyse-modules.ts` regenerates them with `MODEL_SMART` | Derived, editable by staff |
| Timetable slots (`data/slots.json`) | `scripts/generate-slots.ts` (seeded), with published I-Explore and Business School times | Synthetic |
| Cohort (`data/cohort.json`) | `scripts/generate-cohort.ts`: 200 profiles across 8 archetypes | Synthetic |
| Programme rules (`data/programme-rules.json`) | Hand-written for MEng Mechanical Engineering, Years 3 and 4 | Illustrative |
| Pathways (`data/pathways.json`) | Hand-written, 8 pathways | Sample |
| Societies (`data/societies.json`) | Public Imperial College Union listing, 30 societies | Sample |

No real student data is used. No grades, results or protected characteristics are requested, stored or inferred.

## Evaluation

`npm run eval` runs offline and stores the results for the evaluation page.

| Test | Method | Target | Latest |
|---|---|---|---|
| Ranking quality | 12 personas; all three expected modules must appear in the eligible top five | 80% | 10/12 (83%) |
| Extraction | 4 scripted interviews, 33 expected slots | 85% | 33/33 |
| Guardrails | 15 adversarial inputs | 100% | 15/15 |
| Determinism | Same profile ranked twice, with the input order reversed | 100% | 2/2 |
| Privacy threshold | Insights requested for a cohort of four | Blocked | Blocked |

## Known limits

- The data covers one programme and year in depth (MEng Mechanical Engineering, Year 3). Other programmes get permissive placeholder rules.
- The timetable and cohort are synthetic. Capacities and some terms are assumptions, listed in `data/modules.raw.json`.
- Offline-mode extraction is keyword-based. Live mode is more robust to phrasing.
- The engines treat sessions as independent when combining clash probabilities.
- There is no authentication, no real enrolment, and no connection to university systems.

## Documents

- [`docs/LEVEL1.md`](docs/LEVEL1.md): problem, target users, scenario and success metrics.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): inputs, knowledge, tools, decisions and outputs for each agent, with diagrams.
- [`docs/EXAMPLES.md`](docs/EXAMPLES.md): five interactions, including the advisor holding its position.
- [`docs/figma/`](docs/figma/): Figma evidence, tokens and Make prompts.
