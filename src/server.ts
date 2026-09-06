import "dotenv/config";
import { createApp } from "./app";
import { openCloudDatabase } from "./db";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env and paste a Postgres connection string."
    );
  }

  const port = Number(process.env.PORT ?? 3000);
  const { sql } = await openCloudDatabase(databaseUrl);
  const app = createApp(sql);

  app.listen(port, () => {
    console.log(`Coffee shop API listening on ${port}`);
    console.log(`Swagger UI: http://localhost:${port}/docs`);
    console.log(`ReDoc:      http://localhost:${port}/redoc`);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
