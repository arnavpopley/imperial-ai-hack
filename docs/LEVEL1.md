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

This is an illustrative journey. Priya is a persona, and the figures are examples rather than measured results.

Priya is a third-year MEng Mechanical Engineering student. In a three-minute conversation she says she lost track of time in the wind tunnel lab, dreads heavy proofs, wants to work in motorsport, and would try something outside engineering. Her profile fills in as she talks, and every item carries her own words.

The catalogue then ranks every module from 0 to 100. Computational Fluid Dynamics comes top, and its reasons quote her wind-tunnel answer. She raises the career slider and the ranking moves instantly. She shortlists three modules, the timetable flags a certain clash on Tuesday morning, and she accepts a suggested swap that keeps her fit within ten points.

She then asks for a module whose prerequisite she has not taken. The advisor states the rule, offers similar modules she can take, and drafts a request to the Senior Tutor, which she edits and sends. The Senior Tutor replies from the staff console, and the reply appears in her session.

Meanwhile, the module lead for Robotics sees that 38 interested students score under 75 because of the coding load, and that lowering it would raise their fit by about 6 points. They accept the card.

## Success metrics

| Metric | How it is measured | Why it matters |
|---|---|---|
| Share of students who shortlist a module they had not considered | A shortlisted module that was not in the student's "already planning" list at onboarding | Measures whether personalisation surfaces good options students would have missed (for example I-Explore). |
| Clashes caught before enrolment | Certain and likely clashes flagged on shortlists, and how many were resolved by an accepted swap | Moves clash discovery from after choosing to before choosing. |
| Time from first visit to a valid shortlist | From session creation to the first shortlist that passes the rules validator | The quick interview targets about three minutes, and the whole journey should take well under ten. |
| Module-lead insight cards acted on | Insight cards marked accepted or noted, out of all cards shown | Shows the feedback loop to module leads is useful, not just informative. |

Prototype quality is tracked by the evaluation harness (`npm run eval`): ranking quality, extraction accuracy, guardrail pass rate, determinism, and the privacy threshold.
