# Module knowledge base

The module Q&A agent (`server/src/agents/knowledge.ts`) and the catalogue agent's `get_module` tool can only answer from what is stored. This page lists the sources, the stored fields, how many modules have each field, and how to refresh them. Nothing is filled in by hand or by a model: a field appears only when the public page publishes it.

## Sources

All 60 modules come from public pages. Each module's `sourceUrl` is the page it was first taken from, and every published detail carries its own `sourceUrl`.

| Modules | Page | Fields published |
|---|---|---|
| 43 Mechanical Engineering and 1 Bioengineering (`MECH…`, `BIOE96071`) | [Detailed module information](https://www.imperial.ac.uk/mechanical-engineering/study/undergraduate/detailed-module-information/), one page per module (`?module=CODE&year=26_27`) | Aims, ECTS, learning outcomes, syllabus, pre-requisites, teaching methods, an assessment table with pass marks, and a library reading list |
| 3 Business School BPES modules (`BUSI60038`, `BUSI60041`, `BUSI60043`) | The [BPES page](https://www.imperial.ac.uk/business-school/undergraduate/bpes/), plus the public module outline PDF linked from it for each module (`ib-programmes.imperial.ac.uk/hubfs/Website-pdfs/BPES%20module%20outlines/…`) | Page: summary, term, timetable, provisional exam week, restrictions. Outline: learning outcomes, content, teaching, assessment, background |
| 7 I-Explore STEMM and 6 Imperial Horizons modules (`IEX-…`) | One page each under `/centre-for-languages-culture-and-communication/i-explore/stemm-modules/` or `/horizons/module-options/years-3--4-undergraduates/` | Module details, the named lecturer, summary, learning outcomes, indicative content, teaching approach, assessment, key information |

The pages were fetched on 2026-11-14, one at a time with a pause of 1.5 seconds between requests. They were fetched as HTML and parsed by section heading, so the stored text is copied exactly. The text is not rewritten by a model. Three BPES outlines were read from their PDFs.

## Fields

The raw schema is `RawModule` in `server/src/db/datasets.ts`. The fields below are all optional, and each one is present only when the page publishes it.

| Field | Shape | From |
|---|---|---|
| `syllabus` | `{ items, sourceUrl }` | "Module syllabus", "Indicative core content" or "Module Content" |
| `teaching` | `{ paragraphs, sourceUrl }` | "Teaching methods" or "Learning and teaching approach" |
| `hours` | `{ statements, independentStudyHours?, sourceUrl }` | Sentences on the page that state contact or study hours, copied word for word. `independentStudyHours` is set only when the page gives a number ("approximately 105 hours of independent study") |
| `readingList` | `{ items: { title, author?, details?, category? }[], sourceUrl }` | The library reading list on Mechanical Engineering pages. `category` is the list heading (Core, Supplementary, Resources…). Exact duplicate entries are removed |
| `moduleLeads` | `{ names, role, sourceUrl }` | "Contact the lecturer" or "Contact the field leader" on I-Explore and Horizons pages. Names only: published email addresses are deliberately not stored |
| `requirements` | `{ label?, text, sourceUrl }[]` | Published pre-requisite text, expected background (BPES "Additional Information"), I-Explore attendance requirements, and credit restrictions such as "students cannot take both for credit" |
| `assessmentDetails` | `{ passMark?, gradingMethod?, formative?, notes?, sourceUrl }` | The rest of the assessment section: overall pass mark, grading method, zero-weight items (Year 1 and 2 formative progress tests), deadlines, exam weeks and assessment notes |
| `programmeNotes` | `{ label?, text, sourceUrl }[]` | Department and programme notes: delivery, who offers the module, credit rules, term dates, attendance rules |
| `assessment[].passMark`, `.mustPass` | On each weighted item | The pass mark and "Must pass?" columns of the assessment table, and "(Must pass)" on I-Explore pages |
| `assessment[].sourceUrl`, `learningOutcomesSourceUrl` | URL | Set only when the item comes from a page other than the module's `sourceUrl` (the BPES outlines) |

`moduleFacts()` passes every field to both agents, after G3 injection stripping. A field is `null` (or an empty list) when it is not published, so the model can say so. The reading list is capped at 15 entries, and the full count is passed with it. Offline, the rule-based answers cover "who teaches it", "how many hours", "reading list", "how is it taught", "what background do I need" and "when is the exam or deadline". When the field is missing, they decline plainly and point to the module page.

## Coverage

Counts are modules with the field, out of 60.

| Field | MECH and BIOE (44) | BPES (3) | I-Explore and Horizons (13) | All (60) |
|---|---|---|---|---|
| Learning outcomes, before | 44 | 0 | 13 | 57 |
| Learning outcomes, now | 44 | 3 | 13 | **60** |
| Weighted assessment, before | 42 | 0 | 13 | 55 |
| Weighted assessment, now | 44 | 3 | 13 | **60** |
| Pass marks | 43 | 0 | 0 | 43 |
| Deadlines or exam dates | 0 | 3 | 1 | 4 |
| `syllabus` | 43 | 3 | 13 | 59 |
| `teaching` | 41 | 3 | 13 | 57 |
| `hours`, any statement | 12 | 3 | 13 | 28 |
| `hours.independentStudyHours` | 0 | 0 | 13 | 13 |
| `readingList` (212 entries) | 31 | 0 | 0 | 31 |
| `moduleLeads` | 0 | 0 | 13 | 13 |
| `requirements`, any | 23 | 3 | 13 | 39 |
| `requirements`, background text | 15 | 1 | 1 | 17 |
| `assessmentDetails` | 43 | 3 | 6 | 52 |
| `programmeNotes` | 43 | 3 | 13 | 59 |

Corrections made during the refresh:

- **MECH60003** (Design, Make and Test) publishes eight assessed components that were missing. They are now in `assessment`.
- **BIOE96071** publishes "Written exam: Examination; 100% weighting", which was missing.
- **BUSI60038, BUSI60041 and BUSI60043** have learning outcomes and assessment from their BPES outlines, where before they had none.
- **IEX-SPACE**: the description of the 70% component had lost its first words. It is now "Technical and Economic Interactive Poster Presentation submitted as a group".
- The "This is a level 6 version of the enhanced level 7 … module" sentences, trimmed from 14 descriptions, are kept word for word in `requirements`.

No description changed, so the Module Analyst was not re-run, and `data/modules.json` is unchanged. Two things lag the pages until the analyst next runs:

- The derived exam shares of the four corrected modules are still estimates. BIOE96071 is estimated at 60% exam, but its page publishes a 100% written exam. The BPES estimates are 60%, 0% and 70%, but the outlines publish 70%, 0% and 55%.
- The BPES learning outcomes are not yet in `modules.json`. `moduleFacts()` reads the learning outcomes from `modules.raw.json` when the derived record has none, so the agents can already quote them.

## What is not published

These gaps are in the sources, and the agents decline rather than guess:

- **Lecturer names on Mechanical Engineering and BPES pages.** Only the I-Explore and Horizons pages name a lecturer. A Mechanical Engineering page mentions a "Course Leader" without a name.
- **Office hours, contact details for questions, past marks, pass rates and class sizes.** No page publishes these. Published lecturer emails are not stored.
- **Hours for most Mechanical Engineering modules.** 32 of 44 pages do not state hours. Only MECH60019 publishes a timetabled-hours table.
- **Reading lists for BPES, I-Explore, Horizons and 13 Mechanical Engineering or Bioengineering modules.** Horizons pages say only that "Module materials will be accessible though Imperial's library system", which is kept as a programme note.
- **Deadlines.** Only BPES exam weeks and some Horizons due dates ("due at the start of spring term") are published. Mechanical Engineering pages publish none.
- **Terms and capacity** for most modules are still the assumptions listed in `_assumptions` in `data/modules.raw.json`.
- **Student testimonials** on Horizons and I-Explore pages are not stored. They are opinions, not module facts.

## Update procedure

1. Fetch each `sourceUrl` in `data/modules.raw.json` politely: one request at a time, a pause of a second or more between requests, and a descriptive user agent. For BPES modules, also fetch the module outline PDF linked from "View the module outline".
2. Parse each page by section heading:
   - On Mechanical Engineering pages these are `<h3>` sections. "Assessments" is a table, and the reading list is `<li>` items with `h4.title`, `.reading-list-author` and `.reading-list-details`.
   - On I-Explore and Horizons pages the content follows the second "Learning outcomes" heading.
   
   Copy text exactly. Only drop numbering and catalogue punctuation such as a trailing " /".
3. Merge into `data/modules.raw.json`:
   - Leave a field out when the page does not publish it.
   - Give each field the URL it came from.
   - Never store email addresses or testimonials.
   - Update `_note` and `_assumptions` if a source changes.
4. If a description changed materially, re-run the Module Analyst for the changed modules only, with Sonnet (`MODEL_SMART=claude-sonnet-5-5 npx tsx scripts/analyse-modules.ts`, which reads `.env`). The next run also picks up any new published assessment and learning outcomes.
5. Run these checks:
   - `npm test`. `server/tests/knowledge-details.test.ts` checks that every fact has a public Imperial URL, that leads are names only, that weightings sum to 100%, and the offline answers and declines.
   - `npm run eval`.
   - `npm run eval:live`. The "Live: module details" group is generated from the stored fields, so new data gets new cases automatically.
