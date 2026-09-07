import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 9 minimum order total", () => {
  test("rejects orders below 500 cents subtotal", async () => {
    const server = await app();
    const small = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(small.status).toBe(400);

    const ok = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [
          { menu_item_id: 1, quantity: 1 },
          { menu_item_id: 3, quantity: 1 },
        ],
      });
    expect(ok.status).toBe(201);
    expect(ok.body.total_cents).toBe(650);
  });

  test("tip does not count toward the minimum", async () => {
    const server = await app();
    const stillSmall = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        tip_cents: 500,
        items: [{ menu_item_id: 4, quantity: 1 }],
      });
    expect(stillSmall.status).toBe(400);
  });
});
