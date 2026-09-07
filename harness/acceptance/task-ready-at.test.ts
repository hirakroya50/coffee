import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 10 ready timestamp", () => {
  test("sets ready_at when status becomes READY", async () => {
    const server = await app();
    const created = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, size: "SMALL" }],
      });
    expect(created.status).toBe(201);
    expect(created.body.ready_at).toBeNull();

    const preparing = await request(server)
      .patch(`/orders/${created.body.id}/status`)
      .send({ status: "PREPARING" });
    expect(preparing.status).toBe(200);
    expect(preparing.body.ready_at).toBeNull();

    const ready = await request(server)
      .patch(`/orders/${created.body.id}/status`)
      .send({ status: "READY" });
    expect(ready.status).toBe(200);
    expect(ready.body.ready_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
