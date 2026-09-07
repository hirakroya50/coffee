import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 6 syrup flavor", () => {
  test("drinks accept vanilla caramel or hazelnut without price change", async () => {
    const server = await app();
    const order = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 2, quantity: 1, syrup: "caramel" }],
      });
    expect(order.status).toBe(201);
    expect(order.body.items[0].syrup).toBe("caramel");
    expect(order.body.items[0].unit_price_cents).toBe(450);
    expect(order.body.total_cents).toBe(450);
  });

  test("food rejects syrup and drinks reject unknown syrup", async () => {
    const server = await app();
    const food = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 3, quantity: 1, syrup: "vanilla" }],
      });
    expect(food.status).toBe(400);

    const bad = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        items: [{ menu_item_id: 1, quantity: 1, syrup: "maple" }],
      });
    expect(bad.status).toBe(400);
  });
});
