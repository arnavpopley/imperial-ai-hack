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
| fit-high | #156e48 | | Fit 75 and above, high confidence |
| fit-mid | #7d5500 | | Fit 55 to 74, medium confidence |
| fit-low | #a8402f | | Fit under 55, low confidence |
| clash-certain | #b0352a | | Certain clash |
| clash-likely | #964c0e | | Likely clash (30% or more) |
| clash-possible | #d9b310 | | Possible clash (under 30%) |
| mode-onboard | #6b7280 | | Mode chip: Getting started |
| mode-interview | #3b4fd8 | | Mode chip: Interview |
| mode-recommend | #1f8a5b | | Mode chip: Recommendations |
| mode-explain | #7a4fd8 | | Mode chip: Explaining |
| mode-plan | #0e7490 | | Mode chip: Planning timetable |
| mode-escalated | #c0392b | | Mode chip: With a tutor |

## Type and shape

| Token | Value |
|---|---|
| font-sans | Inter, system sans-serif |
| font-mono | JetBrains Mono |
| text-2xs | 12px (0.75rem), the smallest text size |
| radius-card | 14px (0.875rem) |
| Spacing | Tailwind 4px scale |
