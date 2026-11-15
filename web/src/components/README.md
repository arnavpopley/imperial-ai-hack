# Components

Hand-built React components shared by the student app (and available to the staff app). They use only
the design tokens in `web/src/index.css`, so light and dark mode come from the tokens alone. Each
component below has a matching Figma component with the same variant names (spec 14.1).

## AI-state components

| Component | Variants (`variant` prop) | What it shows |
|---|---|---|
| `ModeChip` | `ONBOARD`, `INTERVIEW`, `RECOMMEND`, `EXPLAIN`, `PLAN`, `ESCALATED` | The Supervisor's current mode (spec 12), labelled with `MODE_LABELS` and coloured with the `mode-*` tokens. Live modes (interview, explain, escalated) pulse. |
| `ConfidenceBadge` | `high`, `medium`, `low` | How reliable the scores are, from profile completeness (spec 8.6), as signal bars plus a label. |
| `EvidencePopover` | `quote`, `module-field`, `missing` | Opens from a "because" reason to show the student's own quote with its slot and extractor confidence, or the module record field it cites. `missing` covers a citation that no longer resolves. |
| `GuardrailNotice` | `redacted`, `blocked`, `out-of-scope`, `wellbeing` | An inline notice when a guardrail stage acts (spec 11), with the stage name. `wellbeing` adds support contacts and is announced as an alert. |
| `EscalationCard` | `draft`, `sent`, `answered` | `draft`: the agent's summary, editable, sent only on approval. `sent`: waiting or claimed by staff (`status` prop). `answered`: the staff reply. |
| `ClashMarker` | `certain`, `likely`, `possible` | A timetable clash label with probability (spec 9.2). `compact` renders the icon-only pin used inside the weekly grid. |
| `FitScore` | `ring`, `compact` | The 0 to 100 fit, coloured by the shared band from `@modulematch/shared` (strong 70+ and good 50+ in greens, partial 35+ in amber, weak in red). `size` is `md` or `lg`; `dimmed` greys it for low confidence or ineligible modules. |
| `SubScoreBars` | `stacked`, `compact` | Interest, career goal, learning style and breadth sub-scores. A null goal (no pathway chosen) shows a hatched "n/a" bar. |

## Supporting components

| Component | Variants | Notes |
|---|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md` | `busy` swaps the icon for a spinner. `buttonClass()` styles links as buttons. |
| `ModuleTypeChip` | `core`, `elective`, `i-explore` | Module type label. |
| `Meter` | tones `brand`, `high`, `mid`, `low`, `muted` | ARIA meter for interest strength, completeness and pathway progress. |
| `RangeSlider` | `unset` state | Native range input with a drawn track and thumb, `aria-valuetext`, end labels. |
| `SegmentedControl` | none | Single choice built on radio inputs, so arrow keys work. |
| `MultiSelect` | none | Searchable combobox with a multi-select listbox (completed modules on onboarding). |
| `Drawer` | none | Right-hand slide-over on the native modal `<dialog>` (focus trap, Escape, inert page). |
| `SampleDataLabel` | `modules`, `synthetic`, `pathways` | Spec 15: labels sample and synthetic data wherever it appears. |
| `StateViews` | `LoadingState`, `ErrorState`, `EmptyState`, `Skeleton` | Loading, empty and error states used by every screen. |
| `Icon`, `Spinner` | 30-odd stroke icons | Hand-drawn SVG, so the app has no icon dependency. |

## Tokens added for these components

`surface-2`, `line-strong`, `on-brand`, `scrim`, `module-1` to `module-8` (timetable colours), dark-mode
values for the fit, clash and mode colours, `shadow-soft`, `shadow-lift`, the `ease-out-soft` curve, the
`rise`, `fade`, `slide-in`, `glow`, `caret` and `pulse-dot` animations, and a `hatch` utility for clash
overlaps and n/a bars. All motion is reduced to near zero under `prefers-reduced-motion`.
