import type { Express } from "express";
import { HttpError, type SqlClient } from "./sql";
import { isOrderStatus, VALID_TRANSITIONS, type OrderStatus } from "./types";
import { asyncRoute } from "./menu";
import { priceOrderLine } from "./pricing";

type MenuItemRow = {
  id: number;
  price_cents: number;
  active: number;
  category: string;
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
  size: string | null;
  milk: string | null;
};

async function getOrderWithItems(db: SqlClient, id: number) {
  const orderResult = await db.query<OrderRow>(
    `SELECT id, customer_id, status, total_cents, created_at, updated_at
     FROM orders WHERE id = $1`,
    [id]
  );
  const order = orderResult.rows[0];
  if (!order) {
    return null;
  }
  const items = await db.query<OrderItemRow>(
    `SELECT id, order_id, menu_item_id, quantity, unit_price_cents, line_total_cents, size, milk
     FROM order_items WHERE order_id = $1 ORDER BY id`,
    [id]
  );
  return { ...order, items: items.rows };
}

export function registerOrderRoutes(app: Express, db: SqlClient): void {
  app.post(
    "/orders",
    asyncRoute(async (req, res) => {
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

      const customer = await db.query("SELECT id FROM customers WHERE id = $1", [
        customerId,
      ]);
      if (!customer.rows[0]) {
        res.status(400).json({ error: "customer not found" });
        return;
      }

      try {
        const orderId = await db.transact(async (tx) => {
          let totalCents = 0;
          const priced: Array<{
            menu_item_id: number;
            quantity: number;
            unit_price_cents: number;
            line_total_cents: number;
            size: string | null;
            milk: string | null;
          }> = [];

          for (const raw of items) {
            const menuItemId = Number(raw?.menu_item_id);
            const quantity = Number(raw?.quantity);
            if (!Number.isInteger(menuItemId) || menuItemId < 1) {
              throw new HttpError(400, "invalid menu_item_id");
            }
            if (!Number.isInteger(quantity) || quantity < 1) {
              throw new HttpError(400, "quantity must be >= 1");
            }
            const menuItemResult = await tx.query<MenuItemRow>(
              "SELECT id, price_cents, active, category FROM menu_items WHERE id = $1",
              [menuItemId]
            );
            const menuItem = menuItemResult.rows[0];
            if (!menuItem || Number(menuItem.active) !== 1) {
              throw new HttpError(400, "menu item unavailable");
            }
            const pricedLine = priceOrderLine(menuItem, raw);
            const unitPriceCents = pricedLine.unitPriceCents;
            const lineTotalCents = quantity * unitPriceCents;
            totalCents += lineTotalCents;
            priced.push({
              menu_item_id: menuItemId,
              quantity,
              unit_price_cents: unitPriceCents,
              line_total_cents: lineTotalCents,
              size: pricedLine.size,
              milk: pricedLine.milk,
            });
          }

          const orderResult = await tx.query<{ id: number }>(
            `INSERT INTO orders (customer_id, status, total_cents)
             VALUES ($1, 'PENDING', $2)
             RETURNING id`,
            [customerId, totalCents]
          );
          const newOrderId = Number(orderResult.rows[0].id);

          for (const line of priced) {
            await tx.query(
              `INSERT INTO order_items
               (order_id, menu_item_id, quantity, unit_price_cents, line_total_cents, size, milk)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                newOrderId,
                line.menu_item_id,
                line.quantity,
                line.unit_price_cents,
                line.line_total_cents,
                line.size,
                line.milk,
              ]
            );
          }
          return newOrderId;
        });
        res.status(201).json(await getOrderWithItems(db, orderId));
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    })
  );

  app.get(
    "/orders/:id",
    asyncRoute(async (req, res) => {
      const order = await getOrderWithItems(db, Number(req.params.id));
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      res.json(order);
    })
  );

  app.get(
    "/customers/:id/orders",
    asyncRoute(async (req, res) => {
      const customerId = Number(req.params.id);
      const customer = await db.query("SELECT id FROM customers WHERE id = $1", [
        customerId,
      ]);
      if (!customer.rows[0]) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      const orders = await db.query<OrderRow>(
        `SELECT id, customer_id, status, total_cents, created_at, updated_at
         FROM orders WHERE customer_id = $1 ORDER BY id`,
        [customerId]
      );
      res.json(orders.rows);
    })
  );

  app.patch(
    "/orders/:id/status",
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      const next = req.body?.status;
      if (typeof next !== "string" || !isOrderStatus(next)) {
        res.status(400).json({ error: "invalid status" });
        return;
      }
      const existingResult = await db.query<{ id: number; status: OrderStatus }>(
        "SELECT id, status FROM orders WHERE id = $1",
        [id]
      );
      const existing = existingResult.rows[0];
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
      await db.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
        [next, id]
      );
      res.json(await getOrderWithItems(db, id));
    })
  );
}
