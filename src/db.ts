import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = path.resolve(__dirname, "..");

export function schemaSql(): string {
  return fs.readFileSync(path.join(ROOT, "schema.sql"), "utf8");
}

export function seedSql(): string {
  return fs.readFileSync(path.join(ROOT, "seed.sql"), "utf8");
}

export function applySchemaAndSeed(db: Database.Database): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schemaSql());
  db.exec(seedSql());
}

export function createFreshDatabase(): Database.Database {
  const db = new Database(":memory:");
  applySchemaAndSeed(db);
  return db;
}

export function openFileDatabase(filePath: string): Database.Database {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const exists = fs.existsSync(filePath);
  const db = new Database(filePath);
  db.exec("PRAGMA foreign_keys = ON;");
  if (!exists) {
    applySchemaAndSeed(db);
  }
  return db;
}
