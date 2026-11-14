# Figma evidence

The Figma prize needs evidence of how Figma was used (spec 0 and 14.1). Collect it here.

| Item | Status | Where |
|---|---|---|
| Figma file link | To add | Paste the share link here. |
| Make prompts used | Drafted | [`make-prompts.md`](make-prompts.md) |
| Token set mirrored as Figma variables | Drafted | [`tokens.md`](tokens.md), the same values as `web/src/index.css` |
| AI-state components | Built in code | Listed in `web/src/components/README.md`; recreate them as Figma components with variants |
| Before-and-after screenshots | To capture | Save as `before-*.png` and `after-*.png` in this folder |

## Suggested flow

1. Create Figma variables from `tokens.md` (colour, type and spacing, with light and dark modes).
2. Build the six AI-state components as variant sets: mode chip, confidence badge, evidence popover, guardrail notice, escalation card and clash marker.
3. Use the prompts in `make-prompts.md` in Figma Make to generate the student and staff screens with those components.
4. Screenshot the Make output (before) and the shipped app (after), and note what changed and why.
