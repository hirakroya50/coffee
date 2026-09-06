import express from "express";
import type Database from "better-sqlite3";
import { registerCustomerRoutes } from "./customers";
import { registerMenuRoutes } from "./menu";
import { registerOrderRoutes } from "./orders";

export function createApp(db: Database.Database) {
  const app = express();
  app.use(express.json());
  registerMenuRoutes(app, db);
  registerCustomerRoutes(app, db);
  registerOrderRoutes(app, db);
  return app;
}
