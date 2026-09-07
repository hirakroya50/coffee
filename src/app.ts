import express, { type NextFunction, type Request, type Response } from "express";
import { registerCustomerRoutes } from "./customers";
import { registerDocsRoutes } from "./docs";
import { registerMenuRoutes } from "./menu";
import { registerOrderRoutes } from "./orders";
import type { SqlClient } from "./sql";

export function createApp(db: SqlClient) {
  const app = express();
  app.use(express.json());
  registerDocsRoutes(app);
  registerMenuRoutes(app, db);
  registerCustomerRoutes(app, db);
  registerOrderRoutes(app, db);
  app.get("/info", (_req, res) => {
    res.json({ name: "coffee-shop", api: "v1" });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });
  return app;
}
