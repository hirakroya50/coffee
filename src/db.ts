import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient } from "pg";
import type { SqlClient } from "./sql";

const ROOT = path.resolve(__dirname, "..");

export function schemaSql(): string {
  return fs.readFileSync(path.join(ROOT, "schema.sql"), "utf8");
}

export function seedSql(): string {
  return fs.readFileSync(path.join(ROOT, "seed.sql"), "utf8");
}

export async function applySchemaAndSeed(client: {
  exec?: (sql: string) => Promise<unknown>;
  query: (text: string) => Promise<unknown>;
}): Promise<void> {
  const run = async (sql: string) => {
    if (typeof client.exec === "function") {
      await client.exec(sql);
      return;
    }
    await client.query(sql);
  };
  await run(schemaSql());
  await run(seedSql());
}

function wrapClient(queryFn: SqlClient["query"], transactFn: SqlClient["transact"]): SqlClient {
  return { query: queryFn, transact: transactFn };
}

export function fromPool(pool: Pool): SqlClient {
  const query: SqlClient["query"] = async <T>(text: string, params?: unknown[]) => {
    const result = await pool.query(text, params);
    return { rows: result.rows as T[] };
  };

  return wrapClient(query, async (fn) => {
    const client: PoolClient = await pool.connect();
    const scoped: SqlClient = wrapClient(
      async <T>(text: string, params?: unknown[]) => {
        const result = await client.query(text, params);
        return { rows: result.rows as T[] };
      },
      (inner) => inner(scoped)
    );
    try {
      await client.query("BEGIN");
      const value = await fn(scoped);
      await client.query("COMMIT");
      return value;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
}

export function fromPglite(db: PGlite): SqlClient {
  const query: SqlClient["query"] = async <T>(text: string, params?: unknown[]) => {
    const result = await db.query<T>(text, params ?? []);
    return { rows: result.rows };
  };

  const client = wrapClient(query, async (fn) => {
    await db.query("BEGIN");
    try {
      const value = await fn(client);
      await db.query("COMMIT");
      return value;
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  });
  return client;
}

export async function createFreshDatabase(): Promise<SqlClient> {
  const db = new PGlite();
  await applySchemaAndSeed(db);
  return fromPglite(db);
}

export async function openCloudDatabase(databaseUrl: string): Promise<{
  pool: Pool;
  sql: SqlClient;
}> {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  const sql = fromPool(pool);
  await applySchemaAndSeed(pool);
  return { pool, sql };
}
