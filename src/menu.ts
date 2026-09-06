import type { Express, Request, Response } from "express";
import type Database from "better-sqlite3";

export function registerMenuRoutes(app: Express, db: Database.Database): void {
  app.get("/menu-items", (_req: Request, res: Response) => {
    const items = db
      .prepare(
        `SELECT id, sku, name, description, category, price_cents, active
         FROM menu_items WHERE active = 1 ORDER BY id`
      )
      .all();
    res.json(items);
  });

  app.get("/menu-items/:id", (req: Request, res: Response) => {
    const item = db
      .prepare(
        `SELECT id, sku, name, description, category, price_cents, active
         FROM menu_items WHERE id = ?`
      )
      .get(Number(req.params.id));
    if (!item) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }
    res.json(item);
  });
}
