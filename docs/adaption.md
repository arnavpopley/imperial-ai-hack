# Adaption: stress-testing profile extraction

The Profile Extractor (`server/src/agents/extractor.ts`) turns one interview answer into whitelisted profile slot
updates. We used Adaption's Adaptive Data to grow a reviewed seed into a wider test set, ran our real extractor
against it, fixed what it found, and priced (but did not start) an AutoScientist fine-tune that could take over the
extraction calls. Everything here is reproducible from `scripts/adaption/`.

## 1. What Adaptive Data produced

**Seed.** 34 hand-reviewed rows (`seed-reviewed.jsonl`). Each prompt is the advisor's question plus the student's
answer, and each completion is `{"updates":[{slot, value, dislike?}]}`. Four seed answers contain a disclosure
(a grade, ADHD, nationality, money) next to a real preference, to check redaction.

**Expansion.** `expand.py --similar 150` added 150 "similar" rows (dataset `6e885959-…`, 184 rows in total).
`validate-expanded.ts` checks every row against the extractor's own contract (`isAllowedSlot`,
`schemas.slotValueSchema`, and pathway ids from `data/pathways.json`, since `schemas.PathwayId` accepts any string):

| Result for the 150 new rows | Rows |
| --- | --- |
| Valid labels (every update whitelisted with a valid value) | **0** |
| Advisor question matches no interview step | 107 |
| Slot not whitelisted (the first failure in the row) | 42 |
| Completion not JSON | 1 |

The **prompts** are useful. They are varied phrasings, new questions and realistic constraints ("I work part-time on
Tuesdays and Thursdays from noon until five"). Many have drifted off-domain, though: generic study skills, or a
teacher's point of view ("I use visual block-coding tools to show how computers recognise patterns").

The **completions ignore the schema**. They use invented slots (`interest:behavioral_economics: true`,
`style.presentation_preference`, `timetablePrefs.unavailable_days: ["Friday"]`) and invented values (`true`, `"solo"`).
A deterministic repair (`repair.ts`) that maps the obvious ones onto the whitelist salvages only 17 rows (18 slots
kept, 23 dropped).

**Privacy finding.** Some labels turn disclosures into stored profile data, which spec 20 forbids. Examples:
`pathways: ["anxiety_accommodation"]` for "public speaking is a huge source of anxiety for me";
`interest:gpa_target: 3.8`; `accessibility.requirements: ["extended time on exams"]`; and `timetablePrefs.maxCredits: 12`
for "due to health reasons". A generator that sees only examples, not the whitelist or the privacy rules, will
reproduce the format and miss the rules. Synthetic labels must therefore be validated and reviewed before anything
trains on them or scores against them. We treat Adaption's labels as untrusted and do not use them.

**Relabelling.** We kept Adaption's 150 prompts and relabelled them (`relabel.ts`). Each answer went through the G2/G3
pattern passes first. Our own extractor prompt then drafted a label on Claude Opus 5.5 (low effort), and Claude Fable 5.1
reviewed the drafts in batches of 10 (agree, fix or flag). Result: 96 agreed, 47 fixed, 7 flagged as unusable. Four of
the flagged rows still carried a disclosure that G2 had missed (fixed below). The build agent then checked all 150 by
hand and changed one label (`hand_review` in `relabelled.jsonl`). This used the API (\$1.83) before the budget rule
moved processing into Claude Code. Later labelling should be done by hand. The reviewed set is 34 seed + 143 relabelled
= **177 rows** (`train.jsonl`).

## 2. Stress test

`stress-extractor.ts` runs the extractor on all 177 rows. Each answer goes through the G2 and G3 pattern passes first,
as in the app. Agreement is counted per slot: strengths (interests, style, breadth) within 0.35; pathway and day sets
exactly; flags and times exactly. A slot that only one side sets counts as a disagreement. `--baseline` runs the prompt
and sentence-level G2 from main before this work (`baseline.ts`).

| Run | Slot agreement | Rows exactly right | Seed rows (slots) | Adaption rows (slots) | Cost |
| --- | --- | --- | --- | --- | --- |
| Haiku 4.5, before | 123/246 (**50%**) | 88/177 | 76% | 42% | \$0.24 |
| Haiku 4.5, after | 118/185 (**64%**) | 126/177 | 90% | 53% | \$0.29 |
| Sonnet 5.5 (low effort), after | 128/170 (**75%**) | 143/177 | 86% | 70% | \$0.23 |
| Offline keyword cues, after | 87/186 (47%) | 108/177 | 86% | 30% | free |

Per slot type, Haiku before → after: style 49% → 85% (28 invented style slots → 3); pathwaysSkipped 13% → 100%;
earliest start 43% → 67%; days 60% → 80%; interests 52% → 59%. The denominator falls because the extractor invents less.

**Who was right.** Every disagreement in the two final runs was reviewed by hand (`disagreement-review.json`, with a
reason for each). The reference labels were not assumed to be correct.

| Final run | Disagreements | Reference right (extractor error) | Extractor right | Ambiguous |
| --- | --- | --- | --- | --- |
| Haiku 4.5 | 67 | 29 (16% of slots) | 9 | 29 |
| Sonnet 5.5 | 42 | **4 (2% of slots)** | 14 | 24 |

Most "ambiguous" cases are loose topic mappings on off-domain answers, such as literary criticism or urban planning,
where no taxonomy topic clearly fits. Where the extractor was right, the reviewed label had missed something, such as
fluid mechanics for "lift-to-drag ratios at low Reynolds numbers".

**Is Haiku good enough for extraction?** It is for the scripted quick-interview answers: 90% on the seed, level with
Sonnet. It is not for open, varied answers. Its clear errors are seven times Sonnet's (29 against 4), mostly slots it
reads into the text: a study habit becomes a 06:00 start, a thesis topic becomes a career pathway, "syntax" becomes
coding comfort. Sonnet 5.5 at low effort was also *cheaper* on this run (\$0.23 against \$0.29), because its prompt
cache hits on the 1.2k-token system prompt (cache reads at \$0.20/M), while Haiku 4.5's minimum cacheable prefix is
longer than the prompt. It is slower: 42 s against 28 s for 177 rows at 6 in parallel. **Recommendation: Sonnet 5.5
at low effort for `MODEL_FAST` extraction**, as the stronger-models PR does.

## 3. Fixes

Extractor (`server/src/agents/extractor.ts`):

- **Plausibility guards** (`plausible`, applied to live and offline output). A non-interest slot is kept only when the
  student's words could state it. A start time needs a clock time and must fall between 07:00 and 12:00, so "until
  five" no longer counts. A named day must be in the text, and an empty day list needs the timetable question. A
  pathway needs career words or the career question. `pathwaysSkipped` needs "not sure" or similar. Each style slot
  needs its own vocabulary. These checks remove the invented slots whichever model produced them.
- **Grounding.** Haiku shortens list quotes ("the maths modules were my favourite"), so the old rule (drop any quote
  that is not verbatim) silently lost real interests. A quote whose words appear in order is now mapped to the verbatim
  span; anything else is still dropped.
- **Live prompt mappings:** disliking theory means a high appliedPreference (it was read the wrong way round); dreading
  proofs means low maths comfort; coursework named as a topic is not an assessment preference; "no preference" means
  no days; economics (behavioural, game theory) means finance-economics; "torn between" two careers names both;
  "avoid 8am lectures" means 09:00; pathwaysSkipped is never sent as false.
- **Unknown pathway ids** from the model are dropped (`schemas.PathwayId` accepts any string).
- **Offline cues:** "slog", "not a fan" and "can't stand" are dislikes; an assessment or hands-on preference is no
  longer read off a topic name ("the CFD coursework", "building robots"); "rather do a portfolio"; "solo, though I can
  handle group work"; "avoid 8 AM lectures"; "calculus is harder" gives low maths comfort.
- **Slider answers:** the widget's text ("Maths comfort: 70%. Coding comfort: 40%") is cut before text extraction, so it
  no longer becomes an interest in mathematics (found by the docs agent).

G2 redaction (`server/src/guardrails/g2-redaction.ts`):

- **Clause-level cut.** A matching sentence now loses only its sensitive clauses when it splits cleanly at ", but",
  " but " or "; ". So "I have ADHD … but I enjoy electronics" keeps "I enjoy electronics." A clause that points back to
  the disclosure ("it", "that", "so", "which" …) goes with it. The whole sentence still goes if the match spans a clause
  break, if the kept text still matches a pattern, or if the kept text has a sensitive word (medication, doctor, therapy,
  grades, money, visa and so on). So "I have ADHD; I take medication daily" is removed entirely.
- **New patterns** for disclosures found in the Adaption rows: "due to health reasons", "my anxiety", "a source of
  anxiety", "extended time on exams" or "reasonable adjustments", and a GPA ("aiming for a 3.8"). The sentence splitter
  no longer breaks at a decimal point.

Hard cases. Twenty-one reviewed cases (`scripts/eval-hard-cases.ts`, 32 checks) come from the disagreements. They are
in `npm run eval` as "Extraction (hard cases)" (offline, target 90%: **32/32**), and in `npm run eval:live`
(`-- --hard-cases` runs only these, for a few cents, target 85%). On Haiku they scored 27/32 before the grounding fix and
the last two prompt rules, and **30/32** after. Both remaining failures are Haiku-only: a "torn between" career answer,
and a start time it still reads into "noon until five". The guard now catches that start time.

The full stress runs above were made before the grounding fix, the clock-time guard and the last two prompt rules, to
stay within budget. They therefore slightly understate the "after" numbers. Two more caveats. First, the recorded runs
compared interest values only; the script now also requires the `dislike` flag to match, because that flag decides
whether merging lowers an interest. Second, the recorded "before" run already used the new G2 health patterns, but cut
whole sentences. `baseline.ts` now freezes main's patterns and its verbatim-only grounding as well.

## 4. What a fine-tuned extraction model would replace

`MODEL_FAST` serves seven call sites: the extractor, intent classification, the timetabler and the G1–G4 input
classifiers. A fine-tuned extraction model would replace only `extractLive`, which runs once per interview turn,
with the extractor's system prompt, user message and grounding/guard post-processing unchanged. The other fast-tier
calls are classifiers with their own prompts, and nothing here would train them.

## 5. AutoScientist estimate (no training started)

`autoscientist-estimate.py` uploaded `train.jsonl` in raw prompt/completion mode (dataset
`d91e92e1-3f89-4d5b-b8e0-1b4a069df15b`, 177 rows). It then called only the read-only endpoints:
`autoscientist.list_models`, `datasets.augment(estimate=True)` and `autoscientist.recommend_hyperparams`. Output:
`autoscientist-estimate.json`.

- **Size.** The small models need 1,000 rows at minimum, so 177 rows cannot train on their own and need augmentation.
- **Minimum plan.** Add 823 domain rows, priced at **9 credits** for the augmentation. AutoScientist would pick
  `google/gemma-3-4b-pt`: LoRA r=16, alpha 32, all-linear, 1 epoch, learning rate 5e-5, cosine schedule.
- **Runbook plan.** 20,000 domain rows and 40% general rows (+19,823 domain, +13,334 general), priced at **333 credits**
  for augmentation. AutoScientist would pick `Qwen/Qwen3.5-122B-A10B`: LoRA r=8 on q/v projections, learning rate 1e-4.
- **Recommended fill.** 9,912 domain plus 9,912 general rows, quoted at 200 credits.
- **Training run.** The SDK has no cost estimate for the run itself (`autoscientist.create` has no estimate flag) and
  the docs publish no per-run pricing, so the training cost is unknown until a run is launched. None was launched.

Note that augmentation regenerates rows with the same generator that ignored our schema. Any augmented rows must go
through `validate-expanded.ts` and relabelling before training, or the fine-tune will learn the invented slots.

## 6. Serving

AutoScientist hands back a LoRA adapter as a streamed tar archive (`adapter_config.json`,
`adapter_model.safetensors`, tokenizer files) from the best iteration. Adaption's inference stacks serve its listed
hosted models (for example `gemma-4-31b-it`, `qwen3.5-397b`). The docs do not describe serving a custom AutoScientist
checkpoint there, and their own suggestion is to publish it to the Hugging Face Hub. Serving would therefore mean:
push the adapter to a private Hugging Face repo, then run a Hugging Face Inference Endpoint (TGI or vLLM with the LoRA
on `gemma-3-4b`) or self-host vLLM. This needs the user's Hugging Face token. The extractor would call it through a
small client next to `llm.ts`, with structured output enforced by the server's JSON grammar or validated by zod with a
fallback to the current model.

## 7. Risks

- **Synthetic labels.** Adaption's labels were unusable and, worse, encoded disclosures. Our relabels were drafted and
  reviewed by models and checked by one agent, not by students or advisers. A fine-tune on them learns our current
  conventions, including any we got wrong; the 41 ambiguous disagreements show how loose topic mapping is.
- **No real student data** (spec): every row is synthetic, and many prompts are off-domain or from a teacher's point
  of view. Agreement on real answers is unknown. The seed rows include deliberate disclosures, so a training set must
  keep the rule that completions never encode them.
- **Small model regressions.** A 4B model trained on about 1,000 mostly generated rows may do worse than Sonnet 5.5
  on open answers. It would need to beat the stress test and the live hard cases here before it replaced
  `MODEL_FAST`.

## Spend

Anthropic: about **\$3.10** in total. That is \$1.83 for the Opus/Fable relabel (run before the budget rule changed),
\$1.04 for four full stress runs (Haiku before, interim and after, plus Sonnet after), and about \$0.25 for seed checks,
trial runs and the live hard cases. Adaption: the 150-row expansion that was already running, one 177-row raw upload,
and estimate and recommendation calls only.

## Reproduce

```
uv run --with adaption python scripts/adaption/expand.py --resume <dataset_id>   # download a finished expansion
npx tsx scripts/adaption/validate-expanded.ts                                    # strict validity + repair report
npx tsx scripts/adaption/relabel.ts                                              # API; prefer hand labelling now
npx tsx scripts/adaption/build-train.ts
npx tsx scripts/adaption/stress-extractor.ts --model haiku [--baseline]          # or --model sonnet, --offline
uv run --with adaption python scripts/adaption/autoscientist-estimate.py         # quotes only, never trains
```
