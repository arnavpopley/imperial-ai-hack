# ModuleMatch: problem, users and success metrics

## Problem

Every Imperial student picks modules from the same flat catalogue. The descriptions are identical for everyone, so students choose by rumour and by what their friends pick. Optional modules that would suit them, such as I-Explore, get skipped, and timetable clashes only show up after choices are made. Module leads never learn why a module is under-chosen or what would make it fit more students.

## Target users

| User | What they need |
|---|---|
| Student | To know which optional and I-Explore modules suit them, and how well compulsory modules fit, with reasons they can check. |
| Module lead | To see who a module suits, why it is under-chosen, and which change would raise its fit. |
| Timetabling staff | To see which clashes hurt the most students before the timetable is fixed. |
| Senior Tutor or personal tutor | To receive the cases the agents must not decide alone. |

## Scenario

This is an illustrative journey. Tom is a persona, and every student in the data is synthetic. The figures come from the prototype running offline on that synthetic data (see `docs/EXAMPLES.md`); they are not measured results with real students.

Tom is a third-year MEng Mechanical Engineering student. In a three-minute conversation he says he lost track of time in the wind tunnel lab, would avoid nuclear topics, wants to work in Formula 1 aerodynamics, and prefers coursework and hands-on work. His profile fills in as he talks, and every item carries his own words.

The catalogue then ranks every module from 0 to 100. Fluid Mechanics 3A comes top, and its reasons quote his own answers. He raises the career slider and the ranking moves instantly: Automotive Design with Motorsport A climbs from fifth to second. He shortlists three modules, the timetable flags a certain clash on Monday at 10:00, and he accepts a suggested swap that keeps his fit within ten points.

He then asks for a module whose prerequisite he has not taken. The advisor states the rule, offers similar modules he can take, and drafts a request to the Senior Tutor, which he edits and sends. The Senior Tutor replies from the staff console, and the reply appears in his session.

Meanwhile, the module lead for Mechatronics 3A sees that 30 students in the synthetic cohort shortlisted both it and Embedded C for Microcontrollers A, which clash with certainty in spring. That is the second-highest clash priority in the cohort, so they note the card for the timetabling team.

## Success metrics

| Metric | How it is measured | Why it matters |
|---|---|---|
| Share of students who shortlist a module they had not considered | A shortlisted module that was not in the student's "already planning" list at onboarding | Measures whether personalisation surfaces good options students would have missed (for example I-Explore). |
| Clashes caught before enrolment | Certain and likely clashes flagged on shortlists, and how many were resolved by an accepted swap | Moves clash discovery from after choosing to before choosing. |
| Time from first visit to a valid shortlist | From session creation to the first shortlist that passes the rules validator | The quick interview targets about three minutes, and the whole journey should take well under ten. |
| Module-lead insight cards acted on | Insight cards marked accepted or noted, out of all cards shown | Shows the feedback loop to module leads is useful, not just informative. |

Prototype quality is tracked by two evaluation harnesses. `npm run eval` runs offline and covers ranking quality, extraction accuracy, guardrail pass rate, determinism and the privacy threshold. `npm run eval:live` runs the real models on module facts, declining unknowns, extraction, subtle guardrail cases and grounded explanations. The latest numbers are in the README.
