import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 5 extra shot", () => {
  test("adds 75 cents per drink unit with extra_shot", async () => {
    const server = await app();
    const drink = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 2, extra_shot: true }],
      });
    expect(drink.status).toBe(201);
    expect(drink.body.items[0].unit_price_cents).toBe(425);
    expect(drink.body.total_cents).toBe(850);
  });

  test("food rejects extra_shot", async () => {
    const server = await app();
    const food = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 3, quantity: 1, extra_shot: true }],
      });
    expect(food.status).toBe(400);
  });
});
