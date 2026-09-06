import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 1 drink sizes", () => {
  test("MEDIUM adds 50 cents and LARGE adds 100 cents on drinks", async () => {
    const server = await app();
    const medium = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, size: "MEDIUM" }],
      });
    expect(medium.status).toBe(201);
    expect(medium.body.items[0].unit_price_cents).toBe(400);
    expect(medium.body.total_cents).toBe(400);

    const large = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 2, size: "LARGE" }],
      });
    expect(large.status).toBe(201);
    expect(large.body.items[0].unit_price_cents).toBe(450);
    expect(large.body.total_cents).toBe(900);
  });

  test("food rejects size and drinks reject unknown size", async () => {
    const server = await app();
    const food = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 3, quantity: 1, size: "LARGE" }],
      });
    expect(food.status).toBe(400);

    const bad = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, size: "HUGE" }],
      });
    expect(bad.status).toBe(400);
  });
});
