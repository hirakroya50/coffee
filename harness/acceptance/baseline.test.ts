import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

function app() {
  return createApp(createFreshDatabase());
}

describe("baseline coffee shop API", () => {
  test("lists active menu items and fetches one by id", async () => {
    const server = app();
    const list = await request(server).get("/menu-items");
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(4);
    expect(list.body.every((item: { active: number }) => item.active === 1)).toBe(
      true
    );

    const espresso = list.body.find((item: { sku: string }) => item.sku === "ESP-001");
    expect(espresso).toBeDefined();

    const one = await request(server).get(`/menu-items/${espresso.id}`);
    expect(one.status).toBe(200);
    expect(one.body.sku).toBe("ESP-001");
    expect(one.body.price_cents).toBe(350);

    const missing = await request(server).get("/menu-items/9999");
    expect(missing.status).toBe(404);
  });

  test("creates and fetches a customer; duplicate email is 409", async () => {
    const server = app();
    const created = await request(server)
      .post("/customers")
      .send({ name: "Cara", email: "cara@example.com" });
    expect(created.status).toBe(201);
    expect(created.body.email).toBe("cara@example.com");

    const fetched = await request(server).get(`/customers/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.name).toBe("Cara");

    const duplicate = await request(server)
      .post("/customers")
      .send({ name: "Other", email: "cara@example.com" });
    expect(duplicate.status).toBe(409);

    const missing = await request(server).get("/customers/9999");
    expect(missing.status).toBe(404);
  });

  test("creates an order as PENDING with persisted line items", async () => {
    const server = app();
    const created = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 2 }],
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("PENDING");
    expect(created.body.customer_id).toBe(1);
    expect(created.body.items).toHaveLength(1);
    expect(created.body.items[0].quantity).toBe(2);

    const fetched = await request(server).get(`/orders/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.status).toBe("PENDING");
    expect(fetched.body.items).toHaveLength(1);

    const missing = await request(server).get("/orders/9999");
    expect(missing.status).toBe(404);
  });

  test("prices orders from SQLite and ignores client-sent prices", async () => {
    const server = app();
    const created = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [
          {
            menu_item_id: 1,
            quantity: 2,
            unit_price_cents: 1,
            line_total_cents: 1,
          },
          { menu_item_id: 3, quantity: 1, unit_price_cents: 1 },
        ],
      });
    expect(created.status).toBe(201);
    // ESP-001 350 * 2 + CRO-001 300 * 1
    expect(created.body.items[0].unit_price_cents).toBe(350);
    expect(created.body.items[0].line_total_cents).toBe(700);
    expect(created.body.items[1].unit_price_cents).toBe(300);
    expect(created.body.items[1].line_total_cents).toBe(300);
    expect(created.body.total_cents).toBe(1000);
  });

  test("rejects invalid createOrder payloads", async () => {
    const server = app();
    const empty = await request(server)
      .post("/orders")
      .send({ customer_id: 1, items: [] });
    expect(empty.status).toBe(400);

    const inactive = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 5, quantity: 1 }],
      });
    expect(inactive.status).toBe(400);

    const unknownItem = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 9999, quantity: 1 }],
      });
    expect(unknownItem.status).toBe(400);

    const badQty = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 0 }],
      });
    expect(badQty.status).toBe(400);

    const missingCustomer = await request(server)
      .post("/orders")
      .send({
        customer_id: 9999,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(missingCustomer.status).toBe(400);
  });

  test("lists customer orders and 404s missing customer", async () => {
    const server = app();
    await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });

    const list = await request(server).get("/customers/1/orders");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const missing = await request(server).get("/customers/9999/orders");
    expect(missing.status).toBe(404);
  });

  test("enforces valid order status transitions", async () => {
    const server = app();
    const created = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    const id = created.body.id;

    const skip = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "COMPLETED" });
    expect(skip.status).toBe(409);

    const preparing = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "PREPARING" });
    expect(preparing.status).toBe(200);
    expect(preparing.body.status).toBe("PREPARING");

    const ready = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "READY" });
    expect(ready.status).toBe(200);

    const completed = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "COMPLETED" });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("COMPLETED");

    const afterDone = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "PREPARING" });
    expect(afterDone.status).toBe(409);

    const missing = await request(server)
      .patch("/orders/9999/status")
      .send({ status: "PREPARING" });
    expect(missing.status).toBe(404);
  });

  test("allows PENDING to CANCELLED and treats CANCELLED as terminal", async () => {
    const server = app();
    const created = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    const id = created.body.id;

    const cancelled = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");

    const revive = await request(server)
      .patch(`/orders/${id}/status`)
      .send({ status: "PENDING" });
    expect(revive.status).toBe(409);
  });
});
