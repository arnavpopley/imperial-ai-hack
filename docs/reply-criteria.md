# Reply judging criteria: where each one lives

Each criterion from spec section 2 is mapped to the feature that meets it, the code behind it, and the moment to show it in the live demo. Shot numbers refer to the shot list in [`demo-video.md`](demo-video.md), and slide numbers to [`slides.md`](slides.md). "Live only" marks a moment that is in the live demo (slide 3) but not in the two-minute video.

The Reply case study (code 5532) has not yet been pasted into spec section 21. Until it is, this table follows the Imperial track text as summarised in spec section 2, and the extra deliverables are treated as likely, not confirmed.

## Track criteria

| Reply criterion | Feature | Files | How to show it | Video shot | Slide |
|---|---|---|---|---|---|
| Real university problem | Module choice by rumour, skipped I-Explore options, clashes found after choosing, module leads with no feedback | `docs/LEVEL1.md`, spec section 1 | Open on the problem slide; in the app, point at the ranked I-Explore options next to the department's own electives | 1, 5 | 2 |
| Working prototype | Student app and staff console running end to end on 60 public module descriptions and a synthetic cohort, deployed on Vercel | `web/src`, `server/src`, `scripts/build-vercel.ts`, https://modulematch.vercel.app | Run the whole demo on the live site; fall back to `npm run dev` offline if the network is slow | 1–12 | 3 |
| Session state | Persisted session: mode, profile, evidence, messages, weights, shortlist, interview state and escalations, resumed on reload at the screen for the current mode | `server/src/db/schema.ts`, `server/src/agents/session.ts`, `web/src/student/state/SessionProvider.tsx`, `web/src/student/routes.ts` (`routeForMode`) | Reload the page mid-journey: the profile, shortlist and mode chip come back exactly | Live only | 5 |
| Guardrail pipeline | Eight named stages: G1 scope, G2 redaction, G3 injection, G4 wellbeing on input; G5 schema, G6 grounding, G7 rules, G8 claims on output. Every verdict is a trace event | `server/src/guardrails/*.ts`, `server/src/guardrails/pipeline.ts` | Type "I got a 2:2 last year" in the interview to show the redaction notice; then show the G1–G4 verdicts in the live trace | 11 (the typed redaction is live only) | 6 |
| Real-time interaction | Streamed interview over SSE, a profile panel that fills in live from `profile_update` events, and instant re-ranking as a weight slider moves (the client re-combines the sub-scores with the same `combineFit` the engine uses) | `server/src/routes/student.ts` (`/messages`), `server/src/agents/supervisor.ts`, `packages/shared/src/fit.ts`, `web/src/student/catalogue/WeightPanel.tsx` | Answer one interview question and watch the profile panel; drag the Career slider and watch the cards move | 3, 6 | 4 |
| Specialised agent roles | Supervisor, Interviewer, Profile Extractor, Matcher, Timetabler, Catalogue, module knowledge, Insights, and the offline Module Analyst. Each has a narrow job, fixed tools and zod-validated output | `server/src/agents/*.ts`, `scripts/analyse-modules.ts`, `docs/ARCHITECTURE.md` | "How it works": the agent cards and the animated flowchart of one message; in the app, ask "Which modules are coursework-only in spring?" to show the catalogue agent's tools (live only) | 11 | 4 |
| Dynamic mode-switching | Mode machine with six modes (ONBOARD, INTERVIEW, RECOMMEND, EXPLAIN, PLAN, ESCALATED). Transitions outside the diagram are refused and traced; the mode chip is always visible | `server/src/agents/modes.ts`, `web/src/components/ModeChip.tsx` | Point at the mode chip as it moves Interview → Recommendations → Planning timetable → With a tutor → Recommendations | 4, 7–9 | 5 |
| Human-in-the-loop escalation | Rule exceptions, low confidence, wellbeing and complaints go to staff queues. The student approves every draft; staff replies return to the session. Module leads accept, note or dismiss every insight card, and staff can correct any derived tag | `server/src/agents/escalation.ts`, `server/src/routes/staff.ts`, `web/src/components/EscalationCard.tsx`, `web/src/staff/pages/EscalationDetail.tsx`, `web/src/staff/components/InsightCard.tsx`, `web/src/staff/pages/TagEditor.tsx` | Ask for Nuclear Reactor Physics, approve the draft, switch to Staff and reply; the reply appears in the student chat. Then accept or note an insight card | 8–10 | 6 |

## Likely extra deliverables (spec section 2)

| Deliverable | Where | How to show it | Slide |
|---|---|---|---|
| Problem and metrics write-up | `docs/LEVEL1.md`: users, scenario and four success metrics | Problem slide and the "what we would measure" line on the evaluation slide | 2, 7 |
| Architecture document: inputs, knowledge, tools, decisions, outputs | `docs/ARCHITECTURE.md`: one row per agent, plus the system and mode diagrams | Architecture slide | 4 |
| Interaction examples, including one where the agent holds its position | `docs/EXAMPLES.md`: nine examples; number 2 is the prerequisite refusal | The refusal in the demo | 3 |

## Quality evidence behind the criteria

| Claim | Evidence |
|---|---|
| Numbers come from code, words from models | Scoring, rules, timetable, insights and pathways are pure functions in `server/src/engines`, unit-tested in `server/tests/engines-*.test.ts`. The determinism eval scores the same profile twice with the input order reversed (2/2) |
| Guardrails work on adversarial input | Offline: 15/15 adversarial inputs (`data/eval-latest.json`). Live: 7/7 subtle cases without trigger keywords (`data/eval-live-latest.json`) |
| Answers are grounded | G6 drops any reason whose evidence ID or module field does not exist. Live: the judge passed 4 of 5 persona explanations against everything the Matcher saw. Module Q&A quoted exact assessment weightings and prerequisite codes in 12 of 12 questions, and declined 4 of 4 it could not answer |
| Privacy | No grades or protected characteristics are stored (G2, spec 20); staff views need a cohort of five or more (privacy eval: blocked); feedback is redacted before storage; "Your data" lets a student see, edit and delete everything |

## Figma "Best-Designed AI Product" prize

| Requirement | Where | Status |
|---|---|---|
| Designed in Figma or built with Figma Make | `docs/figma/make-prompts.md` (six Make prompts), `docs/figma/tokens.md` (the token set as Figma variables) | Prompts and tokens are in the repo |
| AI states designed as components | `web/src/components/README.md`: mode chip, confidence badge, evidence popover, guardrail notice, escalation card and clash marker, each with variants | Built in code; Figma variant sets to match |
| Evidence of how Figma was used, in the presentation | `docs/figma/README.md` | The Figma file link and the before-and-after screenshots are still to be added there |
