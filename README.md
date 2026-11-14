# ModuleMatch

A personalised module catalogue for Imperial students, built for the Imperial AI Hackathon (Reply track 05: AI on Campus).
`MODULE_MATCHER_SPEC.md` is the source of truth for the build.

## Run it

```sh
npm install            # Node 22.12 or newer
cp .env.example .env   # add ANTHROPIC_API_KEY
npm run dev            # API on :8790, web on :5173 (also reachable on your LAN)
```

| Script | What it does |
|---|---|
| `npm run dev` | API and web together, with reload. |
| `npm run typecheck` | Type-checks every workspace. |
| `npm test` | Runs the unit and contract tests. |
| `npm run seed` | Builds the SQLite database from `data/`. |
| `npm run eval` | Runs the evaluation harness and prints pass rates. |

## Layout

| Path | Contents |
|---|---|
| `packages/shared` | Zod schemas (the single definition of every contract), inferred types, constants and fixtures. |
| `api` | Hono API: engines, agents, guardrails, routes, database, trace. |
| `web` | React, Vite and Tailwind app: student screens, staff console, trace and evaluation page. |
| `data` | Taxonomy and seed datasets. |
| `scripts` | Seed, analysis, generation and evaluation scripts. |
| `docs` | Architecture, examples, Level 1 write-up and Figma evidence. |

No authentication: the staff console sits behind a role switch in the header.
