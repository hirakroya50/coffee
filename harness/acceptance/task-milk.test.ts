import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 2 milk choices", () => {
  test("drinks may specify milk without changing food pricing", async () => {
    const server = await app();
    const drink = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [
          { menu_item_id: 1, quantity: 1, size: "SMALL", milk: "oat" },
          { menu_item_id: 3, quantity: 1 },
        ],
      });
    expect(drink.status).toBe(201);
    expect(drink.body.items[0].milk).toBe("oat");
    expect(drink.body.items[0].unit_price_cents).toBe(350);
    expect(drink.body.items[1].milk).toBeNull();
    expect(drink.body.items[1].unit_price_cents).toBe(300);
    expect(drink.body.total_cents).toBe(650);
  });

  test("food rejects milk and drinks reject unknown milk", async () => {
    const server = await app();
    const food = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 3, quantity: 1, milk: "oat" }],
      });
    expect(food.status).toBe(400);

    const bad = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, milk: "soy" }],
      });
    expect(bad.status).toBe(400);
  });
});
