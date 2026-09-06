import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 3 cancellation rule", () => {
  test("orders may be cancelled only before PREPARING", async () => {
    const server = await app();
    const pending = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, size: "SMALL" }],
      });
    const pendingId = pending.body.id;
    const cancelPending = await request(server)
      .patch(`/orders/${pendingId}/status`)
      .send({ status: "CANCELLED" });
    expect(cancelPending.status).toBe(200);

    const preparing = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, size: "SMALL" }],
      });
    const preparingId = preparing.body.id;
    await request(server)
      .patch(`/orders/${preparingId}/status`)
      .send({ status: "PREPARING" });
    const cancelPreparing = await request(server)
      .patch(`/orders/${preparingId}/status`)
      .send({ status: "CANCELLED" });
    expect(cancelPreparing.status).toBe(409);
  });
});
