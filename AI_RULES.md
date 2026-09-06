# AI_RULES.md

Stack and constraints for the coffee-shop repository. The coding agent must follow these rules on every run.

## Stack

- Node.js, Express, TypeScript
- PostgreSQL via `DATABASE_URL` (runtime). Acceptance tests use isolated in-memory Postgres (PGlite).
- Jest + Supertest. OpenAPI 3.1 in `openapi.yaml`.
- MCP readiness: `npm run validate:mcp` (generic; no domain-specific checks).

## Architecture

- Business truth lives on the server (prices, totals, state transitions).
- Keep handlers small. Pricing and transitions belong in `src/orders.ts` (or a focused module it calls).
- OpenAPI, `schema.sql`, application code, and tests must stay synchronized.
- Do not invent a second runtime or a frontend.

## Protected paths (never modify)

- `TASK.md`
- `harness/acceptance/**`
- `AI_RULES.md`
- `tools/agent_driver/**` except when the human explicitly tasks orchestrator work (Product TASKs must not change the orchestrator)
- `.github/workflows/**` during a Product TASK run

A candidate that touches `TASK.md` or `harness/acceptance/**` fails immediately.

## Allowed to change during a Product TASK

- `src/**`
- `schema.sql`, `seed.sql`
- `openapi.yaml`
- `tests/generated/**` (optional extra tests; they never replace protected acceptance tests)

## Fix rules

- Smallest change that addresses the triaged root cause.
- Do not refactor unrelated code.
- Do not weaken validation or change success criteria.
- Do not delete or skip protected tests.
- Do not hard-code test values merely to make a test pass.
- If the spec is ambiguous, stop and report `SPEC_AMBIGUITY`. Do not invent requirements.

## MCP-ready OpenAPI

Every operation must have a unique `operationId`, a useful `description`, `responses`, and `$ref` schemas under `components.schemas` for request bodies and success responses.
