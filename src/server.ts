import path from "node:path";
import { createApp } from "./app";
import { openFileDatabase } from "./db";

const dbPath = process.env.SQLITE_PATH ?? path.join(__dirname, "..", "data", "coffee.sqlite");
const port = Number(process.env.PORT ?? 3000);
const db = openFileDatabase(dbPath);
const app = createApp(db);

app.listen(port, () => {
  console.log(`Coffee shop API listening on ${port}`);
});
