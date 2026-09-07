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

1. Start from a known-good commit (`git pull` so orchestrator fixes are present).
2. Protected tests live in `harness/acceptance/` (the builder must not edit them).
3. Run the loop (needs `CURSOR_API_KEY`). `TASK_ID` loads `tasks/TASK-{id}.md` into `TASK.md` automatically:

```bash
TASK_ID=01 npm run builder
```

4. Inspect `artifacts/cycles/task-01/`. Max 5 triage/fix cycles. `SPEC_AMBIGUITY` stops as BLOCKED.

On **PASS** (tests + verifier), the builder creates a **new** branch `cursor/task-{id}-{timestamp}`, commits, pushes, and opens a **PR to `main`**. It does not merge. You still approve the PR.

Local PR creation needs [GitHub CLI](https://cli.github.com/) (`gh auth login`). Dry run without git/PR:

```bash
TASK_ID=01 npm run builder -- --no-pr
```

GitHub: Actions → **Safi Continuous Builder** → Run workflow. Secrets: `CURSOR_API_KEY`. The workflow can open the PR with `GITHUB_TOKEN`.

Proof tasks: `tasks/TASK-01.md` (sizes) through `TASK-10.md`, plus `TASK-11.md` (health check — easiest PR demo).

### Builder outcomes

| Result | `cycles` | Meaning |
|--------|----------|---------|
| `PROTECTED_PATH_VIOLATION` | — | Agent edited `TASK.md` or `harness/acceptance/**` after loop start |
| `FAIL` | `0` | Tests passed but verifier rejected the candidate diff |
| `FAIL` | `1..5` | Triage/fix loop ran but tests still failed after 5 attempts |
| `PASS` | `0` | Task already implemented (empty candidate diff) or fixed on first try |
| `PASS` | `N` | Agent fixed failing tests in N cycles |
| `BLOCKED` | `1..5` | Triage reported `SPEC_AMBIGUITY` |

### Seeing the triage/fix loop

If a task is **already implemented** on your branch, tests pass immediately (`cycles: 0`) and the builder may PASS without calling the verifier.

To exercise the fix loop, run from a commit **before** that feature exists, or use a task whose acceptance tests still fail. For a quick **PR demo**, use `TASK_ID=11` (health check — one small endpoint).

```bash
git checkout <commit-before-feature>
TASK_ID=03 npm run builder -- --no-pr
```
