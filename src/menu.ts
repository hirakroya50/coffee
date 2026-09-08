import type { Express, NextFunction, Request, Response } from "express";
import type { SqlClient } from "./sql";

export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function registerMenuRoutes(app: Express, db: SqlClient): void {
  app.get(
    "/menu-items",
    asyncRoute(async (_req, res) => {
      const result = await db.query(
        `SELECT id, sku, name, description, category, price_cents
         FROM menu_items WHERE active = 1 ORDER BY id`
      );
      res.json(result.rows);
    })
  );

  app.get(
    "/menu-items/:id",
    asyncRoute(async (req, res) => {
      const result = await db.query(
        `SELECT id, sku, name, description, category, price_cents, active
         FROM menu_items WHERE id = $1`,
        [Number(req.params.id)]
      );
      const item = result.rows[0];
      if (!item) {
        res.status(404).json({ error: "Menu item not found" });
        return;
      }
      res.json(item);
    })
  );
}
