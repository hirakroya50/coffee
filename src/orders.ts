import type { Express, Request, Response } from "express";
import type Database from "better-sqlite3";
import { isOrderStatus, VALID_TRANSITIONS, type OrderStatus } from "./types";

type MenuItemRow = {
  id: number;
  price_cents: number;
  active: number;
};

type OrderRow = {
  id: number;
  customer_id: number;
  status: OrderStatus;
  total_cents: number;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: number;
  order_id: number;
  menu_item_id: number;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

function getOrderWithItems(db: Database.Database, id: number) {
  const order = db
    .prepare(
      `SELECT id, customer_id, status, total_cents, created_at, updated_at
       FROM orders WHERE id = ?`
    )
    .get(id) as OrderRow | undefined;
  if (!order) {
    return null;
  }
  const items = db
    .prepare(
      `SELECT id, order_id, menu_item_id, quantity, unit_price_cents, line_total_cents
       FROM order_items WHERE order_id = ? ORDER BY id`
    )
    .all(id) as OrderItemRow[];
  return { ...order, items };
}

export function registerOrderRoutes(app: Express, db: Database.Database): void {
  app.post("/orders", (req: Request, res: Response) => {
    const customerId = Number(req.body?.customer_id);
    const items = req.body?.items;
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ error: "customer_id is required" });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items must be a non-empty array" });
      return;
    }

    const customer = db
      .prepare("SELECT id FROM customers WHERE id = ?")
      .get(customerId);
    if (!customer) {
      res.status(400).json({ error: "customer not found" });
      return;
    }

    const create = db.transaction(() => {
      let totalCents = 0;
      const priced: Array<{
        menu_item_id: number;
        quantity: number;
        unit_price_cents: number;
        line_total_cents: number;
      }> = [];

      for (const raw of items) {
        const menuItemId = Number(raw?.menu_item_id);
        const quantity = Number(raw?.quantity);
        if (!Number.isInteger(menuItemId) || menuItemId < 1) {
          throw Object.assign(new Error("invalid menu_item_id"), { status: 400 });
        }
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw Object.assign(new Error("quantity must be >= 1"), { status: 400 });
        }
        const menuItem = db
          .prepare(
            "SELECT id, price_cents, active FROM menu_items WHERE id = ?"
          )
          .get(menuItemId) as MenuItemRow | undefined;
        if (!menuItem || menuItem.active !== 1) {
          throw Object.assign(new Error("menu item unavailable"), { status: 400 });
        }
        const unitPriceCents = menuItem.price_cents;
        const lineTotalCents = quantity * unitPriceCents;
        totalCents += lineTotalCents;
        priced.push({
          menu_item_id: menuItemId,
          quantity,
          unit_price_cents: unitPriceCents,
          line_total_cents: lineTotalCents,
        });
      }

      const orderResult = db
        .prepare(
          `INSERT INTO orders (customer_id, status, total_cents)
           VALUES (?, 'PENDING', ?)`
        )
        .run(customerId, totalCents);
      const orderId = Number(orderResult.lastInsertRowid);

      const insertItem = db.prepare(
        `INSERT INTO order_items
         (order_id, menu_item_id, quantity, unit_price_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const line of priced) {
        insertItem.run(
          orderId,
          line.menu_item_id,
          line.quantity,
          line.unit_price_cents,
          line.line_total_cents
        );
      }
      return orderId;
    });

    try {
      const orderId = create();
      res.status(201).json(getOrderWithItems(db, orderId));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 400) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      throw err;
    }
  });

  app.get("/orders/:id", (req: Request, res: Response) => {
    const order = getOrderWithItems(db, Number(req.params.id));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(order);
  });

  app.get("/customers/:id/orders", (req: Request, res: Response) => {
    const customerId = Number(req.params.id);
    const customer = db
      .prepare("SELECT id FROM customers WHERE id = ?")
      .get(customerId);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const orders = db
      .prepare(
        `SELECT id, customer_id, status, total_cents, created_at, updated_at
         FROM orders WHERE customer_id = ? ORDER BY id`
      )
      .all(customerId) as OrderRow[];
    res.json(orders);
  });

  app.patch("/orders/:id/status", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const next = req.body?.status;
    if (typeof next !== "string" || !isOrderStatus(next)) {
      res.status(400).json({ error: "invalid status" });
      return;
    }
    const existing = db
      .prepare("SELECT id, status FROM orders WHERE id = ?")
      .get(id) as { id: number; status: OrderStatus } | undefined;
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const allowed = VALID_TRANSITIONS[existing.status];
    if (!allowed.includes(next)) {
      res.status(409).json({
        error: `cannot transition from ${existing.status} to ${next}`,
      });
      return;
    }
    db.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(next, id);
    res.json(getOrderWithItems(db, id));
  });
}
