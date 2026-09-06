# Coffee Shop API + Safi Continuous Builder

Express + TypeScript + Postgres. Schema and seed live in `schema.sql` and `seed.sql`.

## Local API

```bash
cp .env.example .env
# set DATABASE_URL (Postgres) and optional CURSOR_API_KEY
npm install
npm run db:setup
npm run dev
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/redoc

```bash
npm test
npm run validate:mcp
npm run harness
npm run harness:protect
```

Acceptance tests use in-memory Postgres (PGlite), not `DATABASE_URL`.

## TASK → Cursor build → harness

1. Start from a known-good commit.
2. Copy one file from `tasks/` into `TASK.md` (exactly one change).
3. Protected tests live in `harness/acceptance/` (the builder must not edit them).
4. Run the loop (needs `CURSOR_API_KEY`):

```bash
TASK_ID=01 npm run builder
```

5. Inspect `artifacts/cycles/task-01/`. Max 5 triage/fix cycles. `SPEC_AMBIGUITY` stops as BLOCKED.

On **PASS** (tests + verifier), the builder creates a **new** branch `cursor/task-{id}-{timestamp}`, commits, pushes, and opens a **PR to `main`**. It does not merge. You still approve the PR.

Local PR creation needs [GitHub CLI](https://cli.github.com/) (`gh auth login`). Dry run without git/PR:

```bash
TASK_ID=01 npm run builder -- --no-pr
```

GitHub: Actions → **Safi Continuous Builder** → Run workflow. Secrets: `CURSOR_API_KEY`. The workflow can open the PR with `GITHUB_TOKEN`.

Proof tasks: `tasks/TASK-01.md` (sizes), `TASK-02.md` (milk), `TASK-03.md` (cancel only before PREPARING).
