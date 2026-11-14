# Judging deck: outline

Twelve slides for the Reply judging slot (Sunday 13:00–16:30), about five minutes plus the live demo. Each slide gives the exact on-slide text, the speaker notes, and the Reply criteria from spec section 2 that it covers. [`reply-criteria.md`](reply-criteria.md) maps every criterion to the code. Keep the slides sparse; the demo carries the weight.

Every number on these slides is in the repo: the offline evaluation in `data/eval-latest.json`, the live one in `data/eval-live-latest.json`, and the test counts from `npm test`. If either evaluation is rerun before Sunday, update slide 7.

---

## Slide 1: Title

**On the slide**

> # ModuleMatch
> A personalised module catalogue for Imperial students
>
> Numbers from code. Words from models. People in the loop.
>
> Track 05 · Reply Challenge: AI on Campus · modulematch.vercel.app

**Speaker notes**

"ModuleMatch is an AI module advisor. It interviews a student for three minutes, ranks every module for them with reasons they can check, plans a clash-free week, and hands anything it shouldn't decide to a person."

**Criteria:** none (opening).

---

## Slide 2: The problem

**On the slide**

> ## Everyone gets the same catalogue
> - Students pick by rumour and by what friends choose
> - Optional modules that would suit them, such as I-Explore, get skipped
> - Timetable clashes show up after choices are made
> - Module leads never learn why a module is under-chosen
>
> **Users:** students · module leads · timetabling staff · Senior and personal tutors

**Speaker notes**

"Every student reads the same description, so choice is driven by rumour. Clashes are found too late. Module leads get a number of sign-ups and nothing else. We built for four users: the student choosing, the module lead who wants to know who their module suits, the timetabling team, and the tutors who take the cases an AI shouldn't decide." The success metrics are in `docs/LEVEL1.md`: students shortlisting a module they had not considered, clashes caught before enrolment, time to a valid shortlist, and insight cards acted on.

**Criteria:** real university problem; the problem and metrics write-up.

---

## Slide 3: Live demo

**On the slide**

> ## Live demo
> 1. Three-minute interview → profile fills in live
> 2. Ranked catalogue → every reason cites your words
> 3. What-if slider → instant re-rank
> 4. Shortlist → clash → swap
> 5. "Can I take it without the prerequisite?" → refusal and escalation
> 6. Staff reply → back in the student's chat
> 7. Module-lead insight → accept
>
> modulematch.vercel.app

**Speaker notes**

Run the demo from [`demo-video.md`](demo-video.md) (shots 2 to 10), with a judge playing the student if they want to. Point at the mode chip at each step. If the network is slow, switch to the local offline build (`MODULEMATCH_OFFLINE=1 npm run dev`); the decisions are identical because they come from the engines. Reload the page once mid-demo to show the session resumes.

**Criteria:** working prototype; real-time interaction; session state; dynamic mode-switching; human-in-the-loop escalation; an interaction where the agent holds its position.

---

## Slide 4: Architecture

**On the slide**

> ## Numbers from code, words from models
>
> **Agents decide and explain**
> Supervisor · Interviewer · Profile Extractor · Matcher · Timetabler · Catalogue · Module knowledge · Insights · Module Analyst (offline)
>
> **Engines compute** (plain TypeScript, unit-tested)
> Fit score 0–100 · programme rules · clash probability and swaps · counterfactuals · pathway progress
>
> No agent can change a number.
>
> *(diagram: the system overview from `docs/ARCHITECTURE.md`)*

**Speaker notes**

"Every agent has one narrow job, a fixed tool list and validated output. The scores, eligibility and clashes are deterministic code, so the same profile always gets the same ranking; our determinism test checks that. Agents choose what to ask, call the engines as tools, and put the results into words. The catalogue agent, for example, answers 'which modules are coursework-only in spring?' by calling search and compare tools that return the student's real fit. If it names a module code that doesn't exist, the reply is thrown away and the search results are shown instead." Sonnet 5.5 runs the conversational and explaining agents; Haiku 4.5 runs intent, extraction and the guardrail classifiers.

**Criteria:** specialised agent roles; the architecture document (inputs, knowledge, tools, decisions, outputs).

---

## Slide 5: Session state and modes

**On the slide**

> ## One session, six modes
> Getting started → Interview → Recommendations ⇄ Explaining
> Recommendations ⇄ Planning timetable → With a tutor → Recommendations
>
> Saved: profile · evidence · messages · weights · shortlist · escalations
> Leave and come back exactly where you were.
>
> *(diagram: the mode machine from `docs/ARCHITECTURE.md`)*

**Speaker notes**

"The Supervisor is a state machine. A transition outside the diagram is refused and traced, and the current mode is always on screen as a chip. Everything about the session persists in SQLite, so a reload resumes at the screen for the current mode."

**Criteria:** session state; dynamic mode-switching.

---

## Slide 6: Guardrails and human in the loop

**On the slide**

> ## Eight guardrails, every verdict logged
> **In:** G1 scope · G2 redaction · G3 injection · G4 wellbeing
> **Out:** G5 schema · G6 grounding · G7 programme rules · G8 no promises
>
> ## People decide the hard cases
> - Rule exceptions → Senior Tutor
> - Low confidence → personal tutor
> - Wellbeing → student support, only with consent
> - Every insight card waits for a module lead to accept, note or dismiss it
> - Staff can correct any tag the AI derived

**Speaker notes**

"Grades, health and protected characteristics are removed before anything is stored, but a stated interest like 'I want to get involved with the Indian community on campus' is kept: we only remove first-person disclosures. Instructions hidden in a message or a module description are stripped and logged. On the way out, every reason must point to a real quote or module field, and promises about grades or jobs are removed. Escalations are drafted by the agent, approved by the student, and answered by a person; the reply comes back into the session. Staff views never show a group smaller than five."

**Criteria:** guardrail pipeline; human-in-the-loop escalation.

---

## Slide 7: Evaluation

**On the slide**

> ## We measure it
>
> **Offline** (`npm run eval`, no model calls)
> Ranking: 10/12 personas · Extraction: 33/33 slots · Guardrails: 15/15 adversarial inputs · Determinism: 2/2 · Cohort under five: blocked
>
> **Live models** (`npm run eval:live`)
> Module facts: 11/12 exact · Declines what it can't know: 4/4 · Extraction: 33/33 · Subtle guardrail cases: 7/7 · Grounded explanations: 4/5 (Fable 5.1 judge)
>
> 292 server tests · 90 web tests · run in CI on every pull request

**Speaker notes**

"The offline harness runs in seconds with no API calls. The live harness runs the real models against known answers. Its first run scored zero out of five on grounded explanations: explanations quoted raw decimals and claimed preferences the student never stated. We fixed the prompts against the eval rather than by feel. The misses are on the slide on purpose. Two ranking personas get two of their three expected modules into the top five, and one live explanation made a watch-out the data doesn't support." With real students we would measure the four success metrics on slide 2.

**Criteria:** working prototype (quality evidence); guardrail pipeline (tested); the metrics write-up.

---

## Slide 8: The staff side

**On the slide**

> ## Module leads see why, not just how many
> - Demand against capacity, and the fit distribution
> - "30 students shortlisted both Mechatronics 3A and Embedded C, and they clash": the clash card
> - Counterfactuals: which change would raise fit for interested students
> - Clash priority list for timetabling: students × clash probability
>
> Synthetic cohort of 200 · no group under five shown

**Speaker notes**

"This is the part a flat catalogue can't give you. The insights engine finds the students who are interested in a module but whose fit is still under 75. It re-scores them under candidate changes, such as less exam weight or less maths, and reports the uplift. An Insights agent writes the card, but if its rewrite changes any number, the engine's wording is kept. The Mechatronics clash card is real output on our synthetic cohort: it is the second-highest clash priority."

**Criteria:** human-in-the-loop (staff decisions); real university problem (module-lead feedback).

---

## Slide 9: Knowledge base and Adaption

**On the slide**

> ## Grounded in public data
> - 60 real module descriptions from public Imperial pages, each with its source link
> - Module knowledge agent: answers only from a module's own page, and says so when the page can't answer
> - Catalogue agent: searches and compares all 60 modules with tools
>
> ## Adaption (Adaptive Data)
> - A reviewed seed of 34 student answers labelled with the profile slots they fill
> - Expanded with the Adaption API into a larger test set for the Profile Extractor

**Speaker notes**

"Everything the advisor says about a module comes from that module's public record: description, learning outcomes, published assessment and prerequisites. Asked who teaches a module or what the average mark was, it says the record doesn't cover that and links the page; the live eval checks this. For extraction, we wrote and reviewed a small seed set and used Adaption's Adaptive Data API to expand it." See [`knowledge-base.md`](knowledge-base.md) (in progress) and [`adaption.md`](adaption.md) (in progress). Before presenting, check that the Adaption run finished and add its row count from `adaption.md`. If it did not, cut the Adaption half of this slide.

**Criteria:** working prototype (data); specialised agent roles (knowledge and catalogue agents).

---

## Slide 10: Designed in Figma

**On the slide**

> ## The AI's states, designed as components
> Mode chip · Confidence badge · Evidence popover · Guardrail notice · Escalation card · Clash marker
>
> One token set for colour, type and spacing, across the student and staff apps, in light and dark
>
> *(screenshots: the Figma variant sets, the Make output, and the shipped screen side by side)*

**Speaker notes**

"We designed the AI's states, not just the screens. You can see which mode the system is in and how confident it is. Every reason opens the quote it relies on, and every guardrail action is announced. Escalations show draft, sent and answered states, and clashes show whether they are certain, likely or possible." The evidence lives in `docs/figma/`: the token set as Figma variables (`tokens.md`) and the six Make prompts (`make-prompts.md`). Before presenting, add the Figma file link and the before-and-after screenshots to `docs/figma/README.md`, and put the screenshots on this slide. The Figma prize requires the presentation to show how Figma was used.

**Criteria:** the Figma "Best-Designed AI Product" prize.

---

## Slide 11: Privacy and fairness

**On the slide**

> ## Safe by design
> - Interests, goals and learning preferences only
> - Never grades, health, ethnicity, religion, nationality, sexuality, disability or finances
> - Students see, edit and delete everything held about them
> - The advisor recommends and explains; the student decides
> - Every dataset that is sample or synthetic is labelled

**Speaker notes**

"There's no real student data in this build. The cohort, timetable and rules are synthetic or illustrative, and they're labelled wherever they appear. The 'Your data' page shows every quote we hold, and the student can edit or delete all of it. CV text and feedback comments go through the same redaction before anything is stored."

**Criteria:** guardrail pipeline; human-in-the-loop (the student decides).

---

## Slide 12: What's next

**On the slide**

> ## What comes next
> - Societies and competitions from the same profile, with societies adding their own information
> - Career pathways with live opportunities
> - Anonymised post-exam feedback from module leads, after a data protection review
> - Aggregate choices sent to timetabling before the timetable is fixed
> - Summaries of past student feedback on each module
>
> modulematch.vercel.app · github.com/arnavpopley/imperial-ai-hack

**Speaker notes**

"The same profile already drives thin slices for career pathways and societies. The next step is to connect it to live sources, and to feed aggregate choices to timetabling before the timetable is fixed, which turns clash detection into clash prevention. Thank you."

**Criteria:** real university problem (roadmap, spec section 22).
