# Devpost submission

Paste each section below into the matching Devpost field. Every claim can be checked in the repo; the file or command behind each number is named next to it.

**Before you paste**, check these, because they were not final when this was written:

- [ ] The demo video link (see [`demo-video.md`](demo-video.md)).
- [ ] The Figma file link and the before-and-after screenshots in [`figma/README.md`](figma/README.md).
- [ ] The Adaption work: [`adaption.md`](adaption.md) was still in progress. If the Adaption run did not happen, delete the Adaption lines below.
- [ ] The evaluation numbers: offline from `data/eval-latest.json` (15 November) and live from `data/eval-live-latest.json` (15 November). If either is rerun before submitting, copy the new numbers.
- [ ] Whether `ANTHROPIC_API_KEY` is set on the Vercel project. If not, the live site runs in offline mode, so say so next to the link.

---

## Title

ModuleMatch

## Tagline

A three-minute chat, a fit score for every module with reasons you can check, and a clash-free week. Numbers from code, words from models.

## Inspiration

Every Imperial student chooses modules from the same flat catalogue, where everyone reads the same description. So students pick by rumour and by what their friends pick. They skip optional modules that would suit them, such as I-Explore, and find timetable clashes only after they have chosen. Module leads never learn why their module is under-chosen, or what would make it fit more students. We wanted an advisor that knows the student, explains itself, refuses to bend the rules, and hands the hard cases to a person.

## What it does

**For students**

- **Interviews them.** A three-minute adaptive interview builds a profile of interests, goals and learning style. The profile panel fills in live, and every item keeps the student's own words as evidence. A pasted CV is redacted before anything is read. Skipping the interview still works: the catalogue opens in a starter order and claims no fit until there is something to score.
- **Ranks every module from 0 to 100.** Each fit score has four inspectable sub-scores (interest, career goal, learning style, breadth) on one band scale: strong 70+, good 50+, partial 35+. Every reason links to a quote or a field of the module record. Weight sliders show each weight's share and re-rank instantly. Search and a side-by-side compare of two or three modules help narrow it down.
- **Answers questions honestly.** A module knowledge agent answers from one module's public page and says when the page cannot answer. A catalogue agent answers across all 60 modules ("which modules are coursework-only in spring?") by calling search and compare tools. "Will this get me a job?" gets a plain "nobody can promise that", then what the data does say.
- **Plans a week.** A mock timetable flags certain, likely and possible clashes. It suggests swaps that cost under 10 fit points, or wider alternatives with their fit drop when none does. It notes modules near or over capacity and suggests a backup. Nothing changes until the student confirms. The plan exports as a printable PDF and an `.ics` calendar.
- **Holds the line on rules.** Rules are year-aware; where a year's rules are not loaded, it says it cannot confirm rather than guessing. Asked for a module without its prerequisite, it states the rule, offers eligible alternatives and drafts a request to the Senior Tutor, which is sent only when the student approves.
- **Turns marks into feedback (opt-in).** From Year 2, with explicit consent, a student can share a transcript. Marks add gentle notes to catalogue modules without changing any fit and, with a published examiner form, give question-by-question feedback and a revision plan. Withdrawing consent deletes every mark.

**For staff**

- **Decide exceptions.** The Senior Tutor approves or declines a rule-exception request in one click; an approval waives only that module's broken rules, and the decision appears in the student's session.
- **See the aggregate.** Module leads see demand against capacity, the fit distribution, and insight cards they accept, note or dismiss, including counterfactuals ("this change would raise fit for N interested students"). Timetabling staff see which clashes affect the most students. Any count of one to four students is withheld.
- **Write exam feedback.** An examiner writes the feedback form for an exam, or has the AI draft it from marking notes. Students see it only after the examiner publishes.

**For everyone:** the "How it works" page shows the twelve agents, an animated flowchart of one message, offline and live evaluation results, and a live trace of every mode change, agent call, tool call and guardrail verdict. Students can rate any AI answer; the ratings are redacted and export as JSONL for evaluation.

## How we built it

**Numbers come from code, words come from models.** Scores, eligibility, clashes, swaps, counterfactuals and pathway progress are pure TypeScript functions in `server/src/engines`, unit-tested and deterministic. The agents decide what to ask, call the engines as tools, and explain the results. No agent can change a number.

- **Twelve agents**, each with one job:

  | Who it serves | Agents |
  |---|---|
  | Students (9) | Supervisor (six-mode state machine and intent classifier), Interviewer, Profile Extractor, Matcher, Timetabler, Catalogue (tool loop), module knowledge, results reader, exam feedback |
  | Staff (2) | Insights (its rewrite is rejected if any number changes), exam form drafter |
  | Offline (1) | Module Analyst (`scripts/analyse-modules.ts`): public descriptions into taxonomy tags |

  The Supervisor routes each chat turn. Module-page questions take their own route after the input guardrails. The results routes have their own checks: a pasted transcript gets the G3 injection patterns, an uploaded PDF or photo goes to the results reader, which only extracts rows and has instructions stripped from the titles it reads, and exam feedback uses only saved marks and a published examiner form, with the examiner's text stripped of instructions before any model sees it.
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
- **Offline evaluation** (`data/eval-latest.json`): ranking quality 10 of 12 personas (target 80%); extraction 47 of 47; extraction hard cases 33 of 33; guardrails 23 of 23 adversarial inputs; determinism 2 of 2; insights for a cohort of four are blocked.
- **Live evaluation** (`data/eval-live-latest.json`, 15 November, judged by Fable 5.1): all 8 groups meet their target. Module facts 12 of 12, with exact assessment weightings and prerequisite codes; module details 14 of 14; questions the data cannot answer declined 4 of 4; live extraction 46 of 47; extraction hard cases 32 of 33; subtle guardrail cases 7 of 7; grounded explanations 5 of 5; interview routing 3 of 3.
- 602 server tests and 294 web tests, run in CI on every pull request, including axe-core accessibility checks and a test that keeps every font size on the type scale and at 12px or more.
- Route-level code splitting cut the first-load JavaScript from 1,022 kB to 552 kB.
- The staff side is not an afterthought. Every insight waits for a person, every rule exception gets a human decision, no count of one to four students ever leaves the API, and staff can correct the AI's tags.

## What we learned

- Splitting numbers from words made the AI parts testable. Every score is reproducible, so the evaluation can say exactly what changed.
- A live evaluation with known answers found real prompt bugs in minutes that we would not have caught by trying the app.
- An offline path for every agent is worth building on day one. It made the tests fast and free, and the demo cannot fail on the network.

## What's next for ModuleMatch

- Competitions matched from the same profile, and societies supplying their own information (societies are already matched from the public listing).
- Career pathways with opportunities from live sources.
- Real examiner forms and transcripts for the exam feedback that is now built on synthetic ones, after a proper data protection review.
- Aggregate choices fed to timetabling before the timetable is fixed.
- Summaries of past student feedback on each module.
- More programmes than MEng Mechanical Engineering, and real timetable data instead of our synthetic one.

## Built with

TypeScript, React, Vite, Tailwind CSS, Motion, Hono, Node.js, SQLite, Drizzle ORM, zod, Vitest, Anthropic Claude API, Adaption API, Vercel, Figma.

## APIs, models and datasets used

### APIs and models

| API or model | How it is used |
|---|---|
| Anthropic API, `claude-opus-5-5` (`MODEL_SMART`) | Interviewer (streamed), Matcher explanations and refusals, Catalogue agent (tool use, at most four tool rounds), module knowledge agent (summaries and Q&A), exam form drafts and tailored exam feedback, Insights wording, the offline Module Analyst |
| Anthropic API, `claude-sonnet-5-5` at low effort (`MODEL_FAST`) | Profile and CV extraction (structured output), reading uploaded transcript PDFs and photos, and G2 sensitive-span finding |
| Anthropic API, `claude-haiku-4-5` (`MODEL_LIGHT`) | Intent classification, the G1, G3 and G4 guardrail classifiers, timetable wording |
| Anthropic API, `claude-fable-5-1` (`MODEL_JUDGE`) | The independent grader in the live evaluation and the ranking benchmark |
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
| Evaluation cases (`scripts/eval-cases.ts`, `scripts/eval-hard-cases.ts`) | 12 personas, 4 scripted interviews and 22 extraction hard cases, hand-written or reviewed | Synthetic |
| Exam feedback forms (`data/exam-forms.json`) | 4 examiner forms written for the demo from public module descriptions | Synthetic, not real exam papers |
| Demo transcript and marking notes (`data/demo/`) | For trying the results upload and the AI draft | Synthetic |
| Extraction seed for Adaption | 34 student answers with reviewed slot labels; see [`adaption.md`](adaption.md) (in progress) | Synthetic |
| Photos (`web/public/images`) | Pexels, under the Pexels licence (`web/public/images/CREDITS.md`) | Stock photos, not Imperial students |
| Interviewer faces | DiceBear "Lorelei" avatars, CC0 1.0 | Generated |

No real student data is used anywhere. Grades typed in the chat are redacted and never stored; marks are kept only if a student uploads them with explicit consent, are visible only to them and can be deleted at any time. Health and protected characteristics are never requested, stored or inferred.

## Links

- Live demo: https://modulematch.vercel.app
- Source code: https://github.com/arnavpopley/imperial-ai-hack
- Demo video: *(add the link)*
- Figma file: *(add the link)*
- Architecture: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Interaction examples: [`docs/EXAMPLES.md`](EXAMPLES.md)
- Problem and success metrics: [`docs/LEVEL1.md`](LEVEL1.md)
