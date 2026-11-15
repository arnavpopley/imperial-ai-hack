# Design tokens

These mirror the `@theme` block in `web/src/index.css`. Create them as Figma variables with Light and Dark modes.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | #f7f7f4 | #111318 | Page background |
| surface | #ffffff | #1a1d24 | Cards and panels |
| ink | #16181d | #eceef2 | Primary text |
| muted | #5d6270 | #9aa0ad | Secondary text |
| line | #e3e3dc | #2b2f39 | Borders and dividers |
| brand | #3b4fd8 | #7c8cff | Primary actions and focus |
| brand-soft | #e7eafc | #232a52 | Selected and highlighted backgrounds |
| fit-high | #156e48 | #4cc38a | Fit 75 and above, high confidence |
| fit-mid | #7d5500 | #e3b341 | Fit 55 to 74, medium confidence |
| fit-low | #a8402f | #f0806f | Fit under 55, low confidence |
| clash-certain | #b0352a | #f2705f | Certain clash |
| clash-likely | #964c0e | #f5a04a | Likely clash (30% or more) |
| clash-possible | #d9b310 | #e8cb4a | Possible clash (under 30%) |
| mode-onboard | #6b7280 | #a1a7b4 | Mode chip: Getting started |
| mode-interview | #3b4fd8 | #8b99ff | Mode chip: Interview |
| mode-recommend | #1f8a5b | #4cc38a | Mode chip: Recommendations |
| mode-explain | #7a4fd8 | #b08cff | Mode chip: Explaining |
| mode-plan | #0e7490 | #4cc0dc | Mode chip: Planning timetable |
| mode-escalated | #c0392b | #f2705f | Mode chip: With a tutor |
| surface-2 | #f0f0ea | #22252e | Secondary surfaces and tracks |
| line-strong | #cbcbc1 | #3d4250 | Emphasised borders |
| on-brand | #ffffff | #0c0f24 | Text on brand fills |

There are three palettes, and a colour belongs to one of them only. Fit bands (above) say how well something
fits; factors say which part of a fit score; modules say which module.

## Factors (the four parts of a fit score)

Used for the weight sliders, the fit-mix bar, every sub-score bar (catalogue cards, module page, compare,
staff escalation) and nothing else. Each clears 4.5:1 on surface and surface-2.

| Token | Light | Dark | Use |
|---|---|---|---|
| factor-interest | #3b4fd8 | #7c8cff | Interest |
| factor-goal | #0e7490 | #4cc0dc | Career goal |
| factor-style | #7a4fd8 | #b08cff | Learning style |
| factor-breadth | #8a5f00 | #e3b341 | Breadth |

## Assessment types

One slate ramp, darkest for exams, so an assessment never reads as a module or a factor. Each clears the 3:1
non-text contrast on surface and surface-2.

| Token | Light | Dark | Use |
|---|---|---|---|
| assess-exam | #1f2937 | #eceef2 | Exam share |
| assess-coursework | #4b5563 | #b4bac6 | Coursework share |
| assess-practical | #7d8594 | #7d8594 | Practical share |

## Modules

Module identity only: timetable blocks and their legend, and the A, B and C letters in compare.

| Token | Light | Dark |
|---|---|---|
| module-1 | #3b4fd8 | #8b99ff |
| module-2 | #0e8a7e | #3fcfbf |
| module-3 | #c2571a | #f29a5c |
| module-4 | #8e44ad | #c58bf0 |
| module-5 | #b8860b | #e3b341 |
| module-6 | #c0336f | #f07fae |
| module-7 | #2f7fbf | #6cb6f0 |
| module-8 | #5b7a1f | #a3c95a |

`art-1` to `art-8` take the module values for decorative gradients (society banners, agent tiles, card icons).
They carry no meaning, and nothing that carries meaning uses them.

## Type and shape

| Token | Value |
|---|---|
| font-sans | Inter, system sans-serif |
| font-mono | JetBrains Mono |
| text-2xs | 12px (0.75rem), the smallest text size |
| radius-card | 16px (1rem), cards |
| radius-panel | 24px (1.5rem), large panels |
| Spacing | Tailwind 4px scale |
