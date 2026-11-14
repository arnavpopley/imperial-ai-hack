# Ranking benchmark: the engine against an independent tutor

The offline ranking eval (`npm run eval`, spec 18.1) checks 12 personas against three expected modules each. The same build agent that wrote the engine and the tags also wrote those expectations, so a pass partly measures the build agent agreeing with itself. This benchmark is a more defensible measure. A judge that never sees our tags or scores picks modules from the student's own words and the public module pages, and we measure how far the engine's ranking agrees.

Run it with `npm run benchmark` (it needs `ANTHROPIC_API_KEY`). Results go to `data/benchmark-latest.json`, and the headline numbers appear on the "How it works" page (`GET /api/eval/benchmark`).

## Method

**Personas** (`scripts/benchmark/personas.ts`). There are 40 synthetic MEng Mechanical Engineering Year 3 students. Each has passed the Year 1 and 2 core modules, so 31 optional modules are open to them: 15 Mechanical Engineering electives, 3 Business School modules and 13 I-Explore modules. Core modules are excluded because they are not a choice. Each persona has two parts:

- a **description**: what the student says in the interview, written to be read aloud. Only the judge sees it.
- the **structured profile** the extractor would produce from it, on the extractor's scale: about 0.85 to 0.95 for "love", 0.5 to 0.6 for "quite like" or "maybe", 0.1 to 0.2 for "avoid". Unmentioned style dimensions are null. Only the engine sees it.

They cover all eight career pathways plus five undecided students (5 aerospace, 5 energy, 5 robotics, 3 biomedical, 5 software and data, 4 consulting, 4 start-up, 4 research, 5 undecided). They are tagged by trait: 24 have strong preferences, 6 weak, 10 are breadth-hungry, 10 exam-averse, 2 have every style dimension null, 9 have two pathways, and 3 are contradictory. The contradictory ones are a robotics fan who hates coding and maths, a would-be founder who wants no business modules, and a theorist who struggles with exams.

**The judge** (`scripts/benchmark/judge.ts`). Claude Sonnet 5.5, the app's smart tier, at medium effort, prompted as an experienced personal tutor in the department. Its system prompt holds the 31 modules' public pages: title, department, term, ECTS, description, learning outcomes and published assessment, taken from `data/modules.raw.json`. It never sees topics, demand, pathway relevance, fit scores or the structured profile. It returns its top five, ranked, with a one-line reason each, as structured output restricted to the 31 module codes. It is told to rank each module on its own fit and to ignore plan rules such as credit totals and how many I-Explore modules a plan may hold, because the engine ranks modules individually too.

**Two samples per persona**, with the module list in catalogue order for one and reversed for the other, so the judge's position bias averages out. The samples are combined: a module's **votes** (0, 1 or 2) are the number of samples that picked it. A **firm pick** is one both samples chose.

**The engine** ranks the 31 optional modules with `rankModules` and the spec weights (0.45 / 0.25 / 0.20 / 0.10), unchanged.

**Metrics**, per persona and then averaged:

| Metric | Definition |
|---|---|
| precision@5 | Share of the engine's top five that the judge picked in at least one sample |
| recall@5 | Share of the judge's firm picks that reach the engine's top five (if the samples share no pick, all picks count) |
| NDCG@5 | Normalised discounted cumulative gain of the engine's top five, with votes as graded relevance |
| mean rank | Mean position of the judge's picks in the engine's full list of 31, weighted by votes. Lower is better; random is 16 |

There are two reference points. A **random ranking** (seeded Monte Carlo, 2,000 shuffles per persona) is the floor. **Judge self-agreement**, the top-five overlap between the judge's two samples, measures how consistent the judge is. It is not a strict ceiling: precision counts a pick from either sample, so a persona can score 60% precision with 0% self-agreement (`theorist-no-exams` does).

**Robustness check.** The full benchmark was also run with Claude Opus 5.5 as the judge, with the same prompt, samples and metrics (`--judge-model claude-opus-5-5 --out <file>`). That run is not committed; its numbers are quoted below.

## Results

Run on 2026-11-14 with all 40 personas scored. The Opus columns come from the separate robustness run.

| | Engine (Sonnet judge) | Engine (Opus judge) | Random |
|---|---|---|---|
| precision@5 | **72%** | 69% | 19% |
| recall@5 | **72%** | 70% | 16% |
| NDCG@5 | **0.77** | 0.74 | 0.17 |
| mean rank of the judge's picks (of 31) | **5.0** | 5.1 | 16.0 |
| judge self-agreement | 84% | 88% | |

The two judges' consensus top fives overlap by 84%, which gives a sense of how much two independent strong judges agree. The engine (72%) is about 12 points below that and far above random. The comparison is indicative, not exact, because precision@5 counts a pick from either sample. The median persona NDCG@5 is 0.81, and 20 of the 40 personas reach 0.80 or more.

By trait (Sonnet judge):

| Trait | n | P@5 | R@5 | NDCG@5 | Mean rank |
|---|---|---|---|---|---|
| strong preferences | 24 | 77% | 75% | 0.82 | 4.6 |
| multi-pathway | 9 | 76% | 77% | 0.83 | 4.1 |
| breadth-hungry | 10 | 76% | 72% | 0.80 | 4.5 |
| undecided | 5 | 68% | 73% | 0.72 | 5.1 |
| null style | 2 | 70% | 83% | 0.69 | 5.4 |
| exam-averse | 10 | 66% | 57% | 0.70 | 5.9 |
| weak preferences | 6 | 57% | 70% | 0.64 | 5.9 |
| contradictory | 3 | 60% | 48% | 0.57 | 8.0 |

By first pathway, the weakest groups are start-up founders (NDCG@5 0.61, and 0.53 with the Opus judge) and consultants (0.65). The strongest are biomedical (0.97), energy (0.86) and software and data (0.82). The biomedical result holds even though no Year 3 module is biomedical: both judges and the engine fall back to materials and design.

**Diagnostics.** These score the same judge picks against variants of the engine. They are for understanding only; the engine is not changed.

| Variant | P@5 | R@5 | NDCG@5 |
|---|---|---|---|
| spec weights (the engine) | 72% | 72% | 0.77 |
| interest only | 69% | 67% | 0.71 |
| without goal | 68% | 68% | 0.72 |
| without style | 71% | 73% | 0.76 |
| without breadth | 73% | 73% | 0.77 |
| interest over primary topics only (topic weight 0.5 or more) | 71% | 73% | 0.77 |

Every component except breadth adds agreement with the judge, and goal adds the most after interest. Dropping minor topic tags, the bluntest fix for interest dilution, does not change the aggregate. The Opus run shows the same ordering.

<details>
<summary>Per-persona results</summary>

| Persona | Traits | P@5 | R@5 | NDCG@5 | Mean rank | Judge self-agreement | NDCG@5 (Opus judge) |
|---|---|---|---|---|---|---|---|
| aero-cfd | strong | 60% | 60% | 0.68 | 5.4 | 100% | 0.83 |
| aero-structures | strong | 60% | 60% | 0.72 | 3.8 | 100% | 0.72 |
| aero-propulsion | strong | 80% | 100% | 0.89 | 5.9 | 60% | 0.67 |
| motorsport-builder | strong, exam-averse | 60% | 50% | 0.66 | 5.7 | 80% | 0.72 |
| aero-unsure | weak | 60% | 75% | 0.75 | 4.3 | 80% | 0.75 |
| nuclear | strong | 80% | 75% | 0.84 | 4.0 | 80% | 0.75 |
| renewables-policy | strong, breadth, exam-averse | 100% | 75% | 0.91 | 4.8 | 80% | 0.82 |
| batteries-ev | strong | 60% | 60% | 0.70 | 4.2 | 100% | 0.70 |
| energy-economist | multi-pathway, breadth | 80% | 75% | 0.85 | 3.9 | 80% | 0.85 |
| thermo-theorist | strong, multi-pathway | 100% | 100% | 1.00 | 3.0 | 100% | 1.00 |
| robotics-builder | strong | 80% | 80% | 0.83 | 3.8 | 100% | 0.90 |
| embedded-coder | strong, multi-pathway | 60% | 60% | 0.72 | 5.0 | 100% | 0.77 |
| control-theorist | strong, multi-pathway | 60% | 60% | 0.68 | 4.4 | 100% | 0.68 |
| robotics-no-code | contradictory | 80% | 75% | 0.84 | 6.2 | 80% | 0.64 |
| manufacturing-automation | strong | 60% | 75% | 0.77 | 5.8 | 80% | 0.85 |
| biomed-devices | strong | 100% | 100% | 0.99 | 4.5 | 60% | 0.82 |
| biomechanics-research | strong, multi-pathway | 100% | 100% | 1.00 | 3.0 | 100% | 1.00 |
| biomed-vague | weak, null-style | 80% | 100% | 0.93 | 4.2 | 80% | 0.65 |
| data-scientist | strong | 60% | 67% | 0.73 | 6.5 | 60% | 0.75 |
| ml-robotics | strong, multi-pathway, exam-averse | 80% | 75% | 0.84 | 4.1 | 80% | 0.72 |
| software-engineer | strong, exam-averse | 80% | 67% | 0.80 | 5.1 | 60% | 0.72 |
| quant | strong, multi-pathway | 80% | 100% | 0.93 | 4.9 | 80% | 0.93 |
| data-curious | weak | 60% | 100% | 0.81 | 5.1 | 60% | 0.75 |
| consultant | strong, breadth | 100% | 75% | 0.90 | 3.5 | 80% | 0.98 |
| people-consultant | exam-averse, breadth | 60% | 60% | 0.65 | 4.2 | 100% | 0.65 |
| engineering-consultant | weak | 40% | 40% | 0.35 | 8.4 | 100% | 0.51 |
| policy-advisor | strong, breadth, exam-averse | 60% | 60% | 0.68 | 4.8 | 100% | 0.68 |
| founder | strong, breadth, exam-averse | 60% | 50% | 0.66 | 6.5 | 80% | 0.55 |
| hardware-founder | multi-pathway | 60% | 60% | 0.72 | 3.8 | 100% | 0.72 |
| climate-founder | multi-pathway, breadth, exam-averse | 60% | 60% | 0.72 | 5.2 | 100% | 0.72 |
| technical-founder | contradictory | 40% | 40% | 0.35 | 5.6 | 100% | 0.14 |
| applied-mathematician | strong | 80% | 100% | 0.91 | 3.7 | 80% | 0.99 |
| materials-research | strong | 100% | 75% | 0.92 | 3.3 | 80% | 0.88 |
| experimentalist | strong | 80% | 80% | 0.85 | 3.8 | 100% | 0.84 |
| theorist-no-exams | contradictory, exam-averse | 60% | 30% | 0.53 | 12.2 | 0% | 0.08 |
| humanities-explorer | undecided, breadth | 80% | 80% | 0.85 | 3.8 | 100% | 0.85 |
| creative-designer | undecided, breadth | 80% | 80% | 0.83 | 5.0 | 100% | 0.83 |
| all-rounder | undecided, weak, null-style | 60% | 67% | 0.45 | 6.5 | 60% | 0.64 |
| light-load | undecided, weak, exam-averse | 40% | 40% | 0.55 | 6.6 | 100% | 0.59 |
| global-citizen | undecided, breadth | 80% | 100% | 0.93 | 3.7 | 80% | 0.87 |

</details>

## Where the engine and the judge disagree, and why

Across the 40 personas there are 57 engine top-five slots that the judge never picked, and 47 firm judge picks that the engine left out of its top five. In both cases the disagreement is concentrated in a few modules. Six modules account for 31 of the 57 unendorsed slots, and six account for 26 of the 47 misses. That points to specific tags and data, not to a general fault in the formula.

### 1. Missing data: Business School modules with no published assessment

`BUSI60038`, `BUSI60041` and `BUSI60043` publish no assessment. The judge is told so ("not published"). The engine instead uses demand values the Module Analyst inferred: `BUSI60043` Finance & Financial Management has `examShare` 0.7 and `mathsIntensity` 0.6, and `BUSI60038` Business Economics has `examShare` 0.6. For exam-averse founders and consultants, that guessed exam share lowers style fit to 0.38 to 0.50, and `BUSI60043` drops out of the top five for `founder`, `climate-founder` and `people-consultant`. Both judges picked it for all three, because those students said they need finance. A guess at the assessment is being treated as fact. This is the largest single reason why the start-up and consulting groups score lowest.

### 2. Over-weighted secondary themes on a few I-Explore and elective modules (tag candidates)

These modules reach the engine's top five far more often than the judge picks them:

| Module | Engine top five | Judge picked (personas) | What drives the engine |
|---|---|---|---|
| `MECH60019` Tribology A | 12 | 5 (8 unendorsed) | Three common Mechanical Engineering topics (solids 0.6, design 0.6, fluids 0.5) and `aerospace-motorsport` relevance 0.75. It matches almost any Mechanical Engineering profile moderately, and nothing dilutes it |
| `IEX-QUANTUM` Introduction to Quantum Technologies | 5 | 2 | `entrepreneurship-innovation` 0.5 and `policy-ethics` 0.5. The core content (quantum computing, sensing and physics) has no taxonomy topic, so the secondary themes dominate |
| `IEX-SPACE` Space Mining | 6 | 2 | `startup-founder` relevance 0.7, `consulting` 0.6, `entrepreneurship-innovation` 0.5 and all-coursework assessment |
| `IEX-VR` Virtual Reality | 7 | 5 (5 unendorsed) | `programming-software` 0.5 and `software-data` relevance 0.6. The judge reads it as a creative group project, not a coding module, for the five coder personas |

Under-recommended modules where a tag looks thin:

- `IEX-INNOVATE` (Innovation, Communication and Teamwork) was missed 5 times, including for `renewables-policy` and `light-load` with zero interest overlap. Its page describes a design process (problem definition, concept development, refining solutions) on challenges "rooted in health, sustainability, technology", but the tags have no `design-manufacturing` and no `sustainability-climate`.
- `MECH60009` (Embedded C) has `energy-transition` relevance 0.1, although both judges picked it for the battery and electric vehicle persona. `MECH60004` (Introduction to Nuclear Energy) states a "socio-economic context" but has no `finance-economics` tag, so the energy economist gets interest 0.21.

### 3. Interest dilution on multi-topic modules (spec 8.1)

The more tag weight a module carries, the more the judge prefers it relative to the engine. The correlation between a module's total topic weight and (judge votes ÷ 2 minus engine top-five count) is 0.47. The clearest cases are `MECH60001` Machine Dynamics and Vibrations, which has six topics with a total weight of 2.85 and was missed 5 times, and `MECH60024` Automotive Design with Motorsport, which has six topics with a total of 2.65 and was missed 5 times. For `aero-structures`, a student who loves solid mechanics at 0.95, `MECH60001` gets interest 0.34, because its 0.6 solids weight is divided by all six topics. Its mirror image is `MECH60019`, which has only three common topics and is over-recommended. The heuristic flag `interest-dilution` fires on 7 of the 47 misses.

Even so, scoring interest over primary topics only leaves the aggregate unchanged (NDCG@5 0.77 either way), because it fixes some personas and hurts others. Dilution is real for a handful of modules, but this benchmark does not show that changing the formula would be a net win.

### 4. Strong exam aversion is a small term in the fit

The judge treats "I really struggle with exams" almost as a constraint. In the engine, exam preference is one of up to six style dimensions inside the 0.20 style weight, so a complete mismatch costs about 20/K fit points (about 7 points with three stated dimensions). For `theorist-no-exams`, the engine's top five average 99% exam weighting, and the judge's picks average 36%. For `motorsport-builder` the figures are 76% and 52%. Over all personas the mean exam share of the two top fives is the same (0.48 against 0.47), so this matters only when a student states it strongly. Exam-averse personas score 0.70 NDCG@5, against 0.82 for strong preferences overall. This is the spec's weighting working as designed, not a bug.

### 5. Things the profile cannot express

`technical-founder` says "I don't want any business modules". The profile can only record a low breadth appetite (0.1), which removes the breadth bonus (weight 0.10) but cannot penalise anything. So the engine ranks `BUSI60041` Entrepreneurship first for this student, and both judges exclude it. NDCG@5 is 0.35 with the Sonnet judge and 0.14 with the Opus judge. Explicit exclusions have no slot.

### 6. The judge's own biases

Not every disagreement is the engine's fault. Read side by side, the reasons show that the judge:

- **weights assessment format and "hands-on" over subject.** It picks `MECH60009` Embedded C for the CFD aerodynamicist, the creative designer and the undecided all-rounder, because it is "80% coursework" and "build and test". `IEX-INNOVATE` comes in on "all coursework, no maths or coding" for students who never mentioned innovation.
- **generalises from comfort to interest.** It picks `MECH60016` Mathematics A for the data scientist and the embedded coder because they are "comfortable with maths", although neither said they want more maths.
- **prefers "the only module on X".** Both judges pick `MECH60004` Introduction to Nuclear Energy for the energy economist and the engineering consultant, as the only engineering module on energy, although neither student mentioned nuclear and it is a 100% exam.
- **is noisy on low-signal personas.** `theorist-no-exams` has 0% self-agreement: the two samples share no pick. The weak and undecided personas have the lowest self-agreement.

A second, stronger judge (Opus 5.5) reproduces the pattern. The six most over-recommended modules are exactly the same six under both judges (`MECH60019`, `IEX-QUANTUM`, `IEX-SPACE`, `IEX-VR`, `BUSI60038`, `BUSI60041`), and 3 of the 6 most-missed are shared (`MECH60009`, `IEX-INNOVATE`, `MECH60024`). So sections 1 and 2 are not an artefact of one model's taste. The misses are less stable: Opus leans even further towards hands-on, coursework-assessed modules, missing `MECH60009` 7 times. But the 84% agreement between the two judges shows that "what the tutor would pick" is itself only about 85% determined.

### 7. Caveat: the profiles are hand-extracted

I wrote both the descriptions and the structured profiles, following the extractor's scale. A disagreement can therefore come from my extraction rather than from the engine; `engineering-consultant`, with four mild interests, is the likeliest case. An end-to-end variant that runs the live extractor on each description would measure the whole pipeline (see recommendation 6).

## Recommendations, ranked

None of these changes the scoring formula or the spec weights. Items 4 and 5 need the user's approval because they change the spec's design.

1. **Stop treating guessed assessment as fact for `BUSI60038`, `BUSI60041` and `BUSI60043` (missing data, staff review).** Ask staff to confirm the assessment in the tag editor, or set demand to neutral values (`examShare` 0.5, `mathsIntensity` 0.5) until the real assessment is published. This is the biggest lever for the founder and consultant groups.
2. **Staff review of these tags in the tag editor.** These are candidates, not edits; `data/modules.json` was not changed:
   - `IEX-QUANTUM`: `entrepreneurship-innovation` 0.5 and `policy-ethics` 0.5 look high for a module whose main content is quantum physics and computing.
   - `IEX-SPACE`: `pathwayRelevance.startup-founder` 0.7 and `consulting` 0.6 look high for a niche space-resources module.
   - `IEX-VR`: `programming-software` 0.5 and `pathwayRelevance.software-data` 0.6. The page describes a multidisciplinary creative project where coding is one optional role.
   - `MECH60019` Tribology: `pathwayRelevance.aerospace-motorsport` 0.75 puts it in the top five for all five aerospace personas, and its three common topics put it there for seven more. The judge endorsed it in 4 of those 12.
   - `IEX-INNOVATE`: consider adding `design-manufacturing` (around 0.4), because the page describes a design process.
   - `MECH60004`: consider `finance-economics` (around 0.3) for the stated socio-economic content. `MECH60009`: `pathwayRelevance.energy-transition` 0.1 may be low.

   After any tag edit, run `npm run benchmark -- --rescore --db`. The staff editor saves to the app's SQLite database, not to `data/modules.json`, and `--db` scores that catalogue. The judge never sees tags, so its saved picks stay valid and re-scoring costs nothing.
3. **Prune minor tags (below about 0.4) on six-topic modules, case by case**, starting with `MECH60001` and `MECH60024`. This is a tag-level fix for the dilution cases. Do not change the formula: the primary-topics diagnostic shows no aggregate gain.
4. **For the user's decision: let strong statements act as filters, not weights.** "No exams" and "no business modules" are the two clearest failures (sections 4 and 5). A catalogue filter such as "coursework-heavy only" or "hide Business School", set from the interview, would honour them without touching the spec weights.
5. **For the user's decision: an "unknown" demand value.** Spec 8.3 has no way to say "assessment not published". Skipping that dimension, as null student values already are, would make item 1 principled rather than a workaround.
6. **Extend the benchmark end to end.** Run the live extractor on each description and score the engine on the extracted profile, so extraction error is measured too. With the saved judge picks this costs only the extractor calls. Also consider retiring or relabelling the 12 hand-written expectations in `npm run eval`: they are partly circular, and this benchmark replaces them as the ranking-quality measure.

## Cost

Token usage is logged on every run and saved under `cost` in `data/benchmark-latest.json`. The catalogue (about 15,000 tokens per ordering) is cached, so each judge call costs about $0.007 with Sonnet 5.5.

| Run | Calls | Tokens (input / cache write / cache read / output) | Cost |
|---|---|---|---|
| Pilots (2 personas, low and medium effort) | 8 | 1.5k / 30k / 91k / 2.6k | $0.12 |
| Full run, Sonnet 5.5, medium effort | 76 (+4 reused) | 9.6k / 0 / 1.15M / 24k | $0.49 |
| Robustness run, Opus 5.5, medium effort | 80 | 10k / 30k / 1.18M / 46k | $1.60 |
| **Total for this work** | | | **$2.21** |

A fresh full run therefore costs about $0.50, well under the $3 to $5 planned. `--rescore` costs nothing. `--max-dollars` (default 5) stops calling the judge once a run has spent that much.

## Reproducing

```bash
npm run benchmark                     # judge any persona whose saved picks are stale, then score
npm run benchmark -- --rescore        # no API calls: re-score the engine against the saved picks
npm run benchmark -- --rescore --db   # the same, against the app's database (where staff tag edits are saved)
npm run benchmark -- --fresh          # sample the judge again for every persona
npm run benchmark -- --judge-model claude-opus-5-5 --out /tmp/benchmark-opus.json
```

Every successful judge reply is saved, even when the persona's other sample fails, so a re-run never pays for it twice. Saved picks are keyed by a hash of the judge prompt (including the module pages), the persona's description, the model and the effort. Editing a description or a module page re-judges only what changed.
