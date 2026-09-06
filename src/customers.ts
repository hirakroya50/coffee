import type { Express, Request, Response } from "express";
import { isUniqueViolation, type SqlClient } from "./sql";
import { asyncRoute } from "./menu";

export function registerCustomerRoutes(app: Express, db: SqlClient): void {
  app.post(
    "/customers",
    asyncRoute(async (req: Request, res: Response) => {
      const name = req.body?.name;
      const email = req.body?.email;
      if (typeof name !== "string" || name.trim() === "") {
        res.status(400).json({ error: "name is required" });
        return;
      }
      if (typeof email !== "string" || email.trim() === "") {
        res.status(400).json({ error: "email is required" });
        return;
      }
      try {
        const inserted = await db.query(
          `INSERT INTO customers (name, email) VALUES ($1, $2)
           RETURNING id, name, email, created_at`,
          [name.trim(), email.trim()]
        );
        res.status(201).json(inserted.rows[0]);
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: "email already exists" });
          return;
        }
        throw err;
      }
    })
  );

  app.get(
    "/customers/:id",
    asyncRoute(async (req, res) => {
      const result = await db.query(
        `SELECT id, name, email, created_at FROM customers WHERE id = $1`,
        [Number(req.params.id)]
      );
      const customer = result.rows[0];
      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      res.json(customer);
    })
  );
}
