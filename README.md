# Coffee Shop API

Express + TypeScript + Postgres. Schema and seed live in `schema.sql` and `seed.sql`.

## 1. Shared cloud database

Create a Postgres database (Neon is fine: https://console.neon.tech → New project → copy the connection string).

```bash
cp .env.example .env
```

Put the connection string in `.env`:

```
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Every developer uses the **same** `DATABASE_URL`. Tests do **not** use this database; they use an isolated in-memory Postgres (PGlite).

Apply tables and seed data (safe to re-run):

```bash
npm install
npm run db:setup
```

## 2. Run

```bash
npm run dev      # restarts on code changes
npm start        # no watch
```

- API: http://localhost:3000
- Swagger UI (from `openapi.yaml`): http://localhost:3000/docs
- ReDoc (from `openapi.yaml`): http://localhost:3000/redoc
- Raw spec: http://localhost:3000/openapi.yaml and http://localhost:3000/openapi.json

```bash
npm test
npm run validate:mcp
```
