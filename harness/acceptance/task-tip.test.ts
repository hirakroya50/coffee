import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 7 tip on orders", () => {
  test("adds tip_cents to total_cents", async () => {
    const server = await app();
    const order = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        tip_cents: 100,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(order.status).toBe(201);
    expect(order.body.tip_cents).toBe(100);
    expect(order.body.items[0].line_total_cents).toBe(350);
    expect(order.body.total_cents).toBe(450);
  });

  test("defaults tip to zero and rejects negative tips", async () => {
    const server = await app();
    const order = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(order.status).toBe(201);
    expect(order.body.tip_cents).toBe(0);
    expect(order.body.total_cents).toBe(350);

    const bad = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        tip_cents: -1,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(bad.status).toBe(400);
  });
});
