import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

async function createOrder(server: Awaited<ReturnType<typeof app>>, customerId: number) {
  return request(server)
    .post("/orders")
    .send({
      customer_id: customerId,
      items: [{ menu_item_id: 1, quantity: 1 }],
    });
}

describe("task 16 customer total orders", () => {
  test("GET /customers/{id} returns total_orders 0 when customer has no orders", async () => {
    const server = await app();
    const res = await request(server).get("/customers/2");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(2);
    expect(res.body.name).toBe("Bob Patel");
    expect(res.body.email).toBe("bob@example.com");
    expect(res.body.created_at).toBeDefined();
    expect(res.body.total_orders).toBe(0);
  });

  test("GET /customers/{id} returns total_orders 1 after one order", async () => {
    const server = await app();
    const order = await createOrder(server, 1);
    expect(order.status).toBe(201);

    const res = await request(server).get("/customers/1");
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(1);
  });

  test("GET /customers/{id} returns total_orders 3 after multiple orders", async () => {
    const server = await app();
    for (let i = 0; i < 3; i++) {
      const order = await createOrder(server, 1);
      expect(order.status).toBe(201);
    }

    const res = await request(server).get("/customers/1");
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(3);
  });

  test("cancelled orders still count toward total_orders", async () => {
    const server = await app();
    const order = await createOrder(server, 1);
    expect(order.status).toBe(201);

    const cancelled = await request(server)
      .patch(`/orders/${order.body.id}/status`)
      .send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200);

    const res = await request(server).get("/customers/1");
    expect(res.status).toBe(200);
    expect(res.body.total_orders).toBe(1);
  });

  test("GET /customers/{id} returns 404 for missing customer", async () => {
    const server = await app();
    const res = await request(server).get("/customers/9999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Customer not found" });
  });

  test("new customer starts with total_orders 0", async () => {
    const server = await app();
    const created = await request(server)
      .post("/customers")
      .send({ name: "Dana", email: "dana@example.com" });
    expect(created.status).toBe(201);

    const res = await request(server).get(`/customers/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Dana");
    expect(res.body.total_orders).toBe(0);
  });
});
