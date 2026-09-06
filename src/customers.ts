import type { Express, Request, Response } from "express";
import type Database from "better-sqlite3";

export function registerCustomerRoutes(
  app: Express,
  db: Database.Database
): void {
  app.post("/customers", (req: Request, res: Response) => {
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
      const result = db
        .prepare("INSERT INTO customers (name, email) VALUES (?, ?)")
        .run(name.trim(), email.trim());
      const customer = db
        .prepare("SELECT id, name, email, created_at FROM customers WHERE id = ?")
        .get(result.lastInsertRowid);
      res.status(201).json(customer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("UNIQUE")) {
        res.status(409).json({ error: "email already exists" });
        return;
      }
      throw err;
    }
  });

  app.get("/customers/:id", (req: Request, res: Response) => {
    const customer = db
      .prepare("SELECT id, name, email, created_at FROM customers WHERE id = ?")
      .get(Number(req.params.id));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(customer);
  });
}
