# Devpost submission

Paste each section below into the matching Devpost field. Every claim can be checked in the repo; the file or command behind each number is named next to it.

**Before you paste**, check these, because they were not final when this was written:

- [ ] The demo video link (see [`demo-video.md`](demo-video.md)).
- [ ] The Figma file link and the before-and-after screenshots in [`figma/README.md`](figma/README.md).
- [ ] The Adaption work: [`adaption.md`](adaption.md) was still in progress. If the Adaption run did not happen, delete the Adaption lines below.
- [ ] The evaluation numbers: if a later merge reran `npm run eval` or `npm run eval:live`, copy the new numbers from `data/eval-latest.json` and `data/eval-live-latest.json`.
- [ ] Whether `ANTHROPIC_API_KEY` is set on the Vercel project. If not, the live site runs in offline mode, so say so next to the link.

---

## Title

ModuleMatch

## Tagline

A three-minute chat, a fit score for every module with reasons you can check, and a clash-free week. Numbers from code, words from models.

## Inspiration

Every Imperial student chooses modules from the same flat catalogue, where everyone reads the same description. So students pick by rumour and by what their friends pick. They skip optional modules that would suit them, such as I-Explore, and find timetable clashes only after they have chosen. Module leads never learn why their module is under-chosen, or what would make it fit more students. We wanted an advisor that knows the student, explains itself, refuses to bend the rules, and hands the hard cases to a person.

## What it does

- **Interviews the student.** A three-minute adaptive interview builds a profile of interests, goals and learning style. The profile panel fills in live, and every item keeps the student's own words as evidence. A student can also paste a CV, which is redacted before anything is read.
- **Ranks every module from 0 to 100.** Each fit score has four inspectable sub-scores: interest, career goal, learning style and breadth. Every reason links to a quote or a field of the module record. What-if sliders re-rank instantly, and ineligible modules stay visible, greyed, with the reason.
- **Answers questions.** A module knowledge agent answers questions about one module from its public page and says plainly when the page cannot answer. A catalogue agent answers questions across all 60 modules, such as "which modules are coursework-only in spring?", by calling search and compare tools.
- **Builds a mock timetable.** It flags certain, likely and possible clashes, and suggests swaps that cost less than 10 fit points. A swap is applied only when the student confirms it.
- **Holds the line on rules, and escalates.** Asked for a module without its prerequisite, the advisor states the rule, offers eligible alternatives, and drafts a request to the Senior Tutor. The request is sent only when the student approves it. The tutor replies from the staff console, and the reply appears in the student's session.
- **Gives staff the aggregate view.** Module leads see demand against capacity, the fit distribution, and insight cards they accept, note or dismiss. Counterfactual cards say which change would raise fit for interested students. Timetabling staff see which clashes affect the most students. Staff can also correct any module's derived tags.
- **Shows its work.** The "How it works" page shows the agents, an animated flowchart of one message, evaluation pass rates, and a live trace of every mode change, agent call, tool call and guardrail verdict. Students can rate any AI answer, and the redacted ratings export as JSONL for evaluation.

## How we built it

**Numbers come from code, words come from models.** Scores, eligibility, clashes, swaps, counterfactuals and pathway progress are pure TypeScript functions in `server/src/engines`, unit-tested and deterministic. The agents decide what to ask, call the engines as tools, and explain the results. No agent can change a number.

- **Agents** (`server/src/agents`): a Supervisor with a six-mode state machine (onboard, interview, recommend, explain, plan, escalated) and an intent classifier. It routes each chat turn to the Interviewer, Profile Extractor, Matcher, Timetabler or Catalogue agent. Questions on a module's page take their own route: after the input guardrails, they go straight to the module knowledge agent. An Insights agent writes the staff cards, and its rewrite is rejected if any number changes. The offline Module Analyst (`scripts/analyse-modules.ts`) turns public descriptions into taxonomy tags.
- **Eight guardrails** (`server/src/guardrails`): scope, sensitive-data redaction, injection and wellbeing checks on input; schema, grounding, programme-rules and claims checks on output. Every verdict is traced. Grades, health and protected characteristics are removed before anything is stored, while stated interests are kept.
- **Stack:** React, Vite and Tailwind on the front; Hono on Node with SQLite (better-sqlite3 and Drizzle) on the back; zod contracts shared between the two (`packages/shared`). Deployed on Vercel as static files plus one Node function.
- **Offline mode:** every agent has a deterministic path, so the whole journey runs with no API key. The tests and the offline evaluation always run this way.
- **Evaluation:** `npm run eval` runs offline; `npm run eval:live` runs the real models against cases with known answers, with a model judge for the open-ended ones.

## Challenges we ran into

- **Thinking ate the reply.** Our smart model always thinks before answering, and thinking counts towards `max_tokens`. With small output caps, replies arrived empty or cut off. Smart-tier calls now never go below 8,000 output tokens. They run at low effort for chat, and an incomplete reply falls back to the template (`server/src/agents/llm.ts`).
- **Measuring instead of guessing.** The first live evaluation scored 0 of 5 on grounded explanations. Some of that was the harness: the judge lacked context. Some was real: explanations quoted raw decimals and claimed matches on preferences the student never stated. We fixed the Matcher, knowledge-agent and extractor prompts against the eval (pull request #34).
- **Keeping the model away from numbers.** The insights rewrite is rejected if any number changes. Catalogue answers that name a module code not in the catalogue are replaced by the search results, and claims about grades or jobs are filtered before the student sees them.
- **Redacting without erasing people.** "I am Indian" must never be stored, but "I want to get involved with the Indian community on campus" is a stated interest that should be matched. G2 removes first-person disclosures only.
- **Deploying.** Vercel treats every file in a top-level `api/` folder as a separate function, so the backend moved to `server/`, and we build our own Build Output API bundle (`scripts/build-vercel.ts`).

## Accomplishments that we're proud of

- The full journey works end to end, live or offline: interview, ranked catalogue, explanations, what-ifs, timetable and swap, refusal, escalation, staff reply, module-lead insights and trace.
- **Offline evaluation** (`data/eval-latest.json`): ranking quality 10 of 12 personas (target 80%); extraction 33 of 33 slots; guardrails 15 of 15 adversarial inputs; determinism 2 of 2; insights for a cohort of four are blocked.
- **Live evaluation** (`data/eval-live-latest.json`): module facts 12 of 12, with exact assessment weightings and prerequisite codes; questions the data cannot answer declined 4 of 4; live extraction 32 of 33 slots; subtle guardrail cases 7 of 7; grounded explanations 4 of 5, graded by a model judge.
- 292 server tests and 90 web tests, run in CI on every pull request.
- The staff side is not an afterthought. Every insight waits for a person, no group under five students is ever shown, and staff can correct the AI's tags.

## What we learned

- Splitting numbers from words made the AI parts testable. Every score is reproducible, so the evaluation can say exactly what changed.
- A live evaluation with known answers found real prompt bugs in minutes that we would not have caught by trying the app.
- An offline path for every agent is worth building on day one. It made the tests fast and free, and the demo cannot fail on the network.

## What's next for ModuleMatch

- Societies and competitions matched from the same profile, with societies supplying their own information.
- Career pathways with opportunities from live sources.
- Anonymised strengths-and-weaknesses feedback from module leads after exams, subject to a proper data protection review.
- Aggregate choices fed to timetabling before the timetable is fixed.
- Summaries of past student feedback on each module.
- More programmes than MEng Mechanical Engineering, and real timetable data instead of our synthetic one.

## Built with

TypeScript, React, Vite, Tailwind CSS, Motion, Hono, Node.js, SQLite, Drizzle ORM, zod, Vitest, Anthropic Claude API, Adaption API, Vercel, Figma.

## APIs, models and datasets used

### APIs and models

| API or model | How it is used |
|---|---|
| Anthropic API, `claude-sonnet-5-5` (`MODEL_SMART`) | Interviewer (streamed), Matcher explanations and refusals, Catalogue agent (tool use, at most four tool rounds), module knowledge agent (summaries and Q&A), Insights wording, the offline Module Analyst, and the judge in the live evaluation |
| Anthropic API, `claude-haiku-4-5` (`MODEL_FAST`) | Intent classification, profile and CV extraction (structured output), the G1–G4 guardrail classifiers, timetable wording |
| Anthropic TypeScript SDK (`@anthropic-ai/sdk`) | Streaming, tool use, zod-validated structured outputs, prompt caching on system prompts, and server-side refusal fallbacks on Sonnet-tier calls (`server/src/agents/llm.ts`) |
| Adaption API (Adaptive Data) | Expands a hand-reviewed seed set of student answers paired with the profile slots they should fill, to give the Profile Extractor more test data. Write-up: [`adaption.md`](adaption.md) (in progress) |

Model IDs are configuration (`.env.example`), never hard-coded in the agents. Scoring makes no model calls.

### Datasets

| Dataset | Source | Label |
|---|---|---|
| 60 module descriptions (`data/modules.raw.json`) | Public Imperial module pages: Mechanical Engineering Years 1–4, Business School options and I-Explore, each with its source URL, fetched 14 November 2026 | Public; a sample, not an official catalogue |
| Derived module tags (`data/modules.json`) | Topic, skill, pathway and demand weights written to the Module Analyst's rules from the public descriptions (the README says how the committed tags were produced); editable by staff | Derived from public data |
| Societies (`data/societies.json`) | 30 societies from the public Imperial College Union A–Z listing, summarised in our own words | Public sample |
| Timetable slots (`data/slots.json`) | `scripts/generate-slots.ts`, seeded; the published I-Explore and Business School times are kept | Synthetic |
| Student cohort (`data/cohort.json`) | `scripts/generate-cohort.ts`: 200 invented Year 3 students across 8 archetypes | Synthetic |
| Programme rules (`data/programme-rules.json`) | Hand-written for MEng Mechanical Engineering Years 3 and 4, following the public module-selection page | Sample (illustrative, not the official regulations) |
| Career pathways (`data/pathways.json`) | 8 hand-written pathways with illustrative skill weights | Sample |
| Topic taxonomy (`data/taxonomy.json`) | 26 topics and 10 skills, hand-written | Sample |
| Evaluation cases (`scripts/eval-cases.ts`) | 12 personas and 4 scripted interviews, hand-written | Synthetic |
| Extraction seed for Adaption | 34 student answers with reviewed slot labels; see [`adaption.md`](adaption.md) (in progress) | Synthetic |
| Photos (`web/public/images`) | Pexels, under the Pexels licence (`web/public/images/CREDITS.md`) | Stock photos, not Imperial students |
| Interviewer faces | DiceBear "Lorelei" avatars, CC0 1.0 | Generated |

No real student data is used anywhere. No grades, results or protected characteristics are requested, stored or inferred.

## Links

- Live demo: https://modulematch.vercel.app
- Source code: https://github.com/arnavpopley/imperial-ai-hack
- Demo video: *(add the link)*
- Figma file: *(add the link)*
- Architecture: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Interaction examples: [`docs/EXAMPLES.md`](EXAMPLES.md)
- Problem and success metrics: [`docs/LEVEL1.md`](LEVEL1.md)
