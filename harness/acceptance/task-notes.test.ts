import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 4 order notes", () => {
  test("stores and returns notes on create", async () => {
    const server = await app();
    const created = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        notes: "light ice please",
        items: [{ menu_item_id: 1, quantity: 1, size: "SMALL" }],
      });
    expect(created.status).toBe(201);
    expect(created.body.notes).toBe("light ice please");

    const fetched = await request(server).get(`/orders/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.notes).toBe("light ice please");
  });

  test("rejects empty or oversized notes", async () => {
    const server = await app();
    const empty = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        notes: "",
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(empty.status).toBe(400);

    const long = await request(server)
      .post("/orders")
      .send({
        customer_id: 1,
        notes: "x".repeat(201),
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(long.status).toBe(400);
  });
});
