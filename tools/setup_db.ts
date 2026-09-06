import "dotenv/config";
import { openCloudDatabase } from "../src/db";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Copy .env.example to .env.");
  }
  await openCloudDatabase(databaseUrl);
  console.log("Applied schema.sql and seed.sql to DATABASE_URL");
  process.exit(0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
