# Figma Make prompts

Paste these into Figma Make one at a time. Each one assumes the variables in `tokens.md` and the six AI-state components already exist in the file.

## 1. Design system

> Create a design system for "ModuleMatch", a university module advisor. Use the colour variables provided (canvas, surface, ink, muted, line, brand, the fit colours, the clash colours and the six mode colours), Inter for text, 14px card radius and a 4px spacing scale. Build these components with variants: Mode chip (Getting started, Interview, Recommendations, Explaining, Planning timetable, With a tutor); Confidence badge (high, medium, low); Evidence popover (a reason linked to the student's own quote, with a quote mark and "You said"); Guardrail notice (redacted, blocked, out of scope, wellbeing); Escalation card (draft with editable text and Approve, sent with status, answered with the staff reply); Clash marker (certain solid, likely striped, possible dotted). The tone is calm and trustworthy, for students and staff.

## 2. Interview

> Design the interview screen. Left: a chat with an advisor that asks one short question at a time; one message has two inline sliders for "maths comfort" and "coding comfort". Right: a "Your profile" panel that fills in live, with interests as labelled strength bars, learning-style rows, career pathway chips and timetable preferences. Each item shows a small quote of what the student said. Top: the Interview mode chip and a "Skip to recommendations" link. End state: a "Here is what I heard" card with Confirm and Edit.

## 3. Catalogue

> Design a ranked module catalogue. Top: four what-if sliders (Interests, Career, Learning style, Breadth) with a Reset link and a note that sample public descriptions are used. Cards: module code and title, type chip (Core, Elective, I-Explore), a large fit score from 0 to 100 coloured by band, four thin sub-score bars, a confidence badge and a shortlist toggle. Ineligible modules are greyed with the reason, such as "Requires MECH50010". Include a medium-confidence banner offering two more questions.

## 4. Module detail

> Design a module detail page. Summary sentence, then "Why it fits you" reasons, each with an evidence popover showing the student's quote or the module field it relies on. Then watch-outs, prerequisites, learning outcomes, a "Public description" source link and a Shortlist button.

## 5. Timetable

> Design a weekly timetable (Mon to Fri, 09:00 to 18:00) for autumn and spring terms, with module blocks in distinct colours. Provisional slots are dashed with a probability label. Clashes are highlighted with clash markers. Beside each clash is a swap suggestion card: "Swap X for Y? Fit 71 (−4)" with Confirm. Programme rule warnings show at the top.

## 6. Staff console

> Design a staff console for module leads. Left: a module list with shortlisted against capacity and average fit. Main: a demand-against-capacity gauge, a 10-bucket fit distribution histogram, and insight cards (Counterfactual with a prominent "+6 fit", Overlooked, Demand, Clash), each with Accept, Note and Dismiss. Also design a tag editor with weight sliders beside the analyst's rationale, a clash priority list, and an escalation queue with a reply box. Label every number "Synthetic cohort".
