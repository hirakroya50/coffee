import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 17 menu list without active", () => {
  test("GET /menu-items omits active from each item", async () => {
    const server = await app();
    const list = await request(server).get("/menu-items");
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(4);

    for (const item of list.body) {
      expect(item).not.toHaveProperty("active");
      expect(item).toMatchObject({
        id: expect.any(Number),
        sku: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        price_cents: expect.any(Number),
      });
    }

    const espresso = list.body.find((item: { sku: string }) => item.sku === "ESP-001");
    expect(espresso).toBeDefined();
    expect(espresso.price_cents).toBe(350);
  });

  test("GET /menu-items still excludes inactive items", async () => {
    const server = await app();
    const list = await request(server).get("/menu-items");
    expect(list.status).toBe(200);
    expect(list.body.some((item: { sku: string }) => item.sku === "OLD-001")).toBe(
      false
    );
  });

  test("GET /menu-items/{id} may still include active", async () => {
    const server = await app();
    const one = await request(server).get("/menu-items/1");
    expect(one.status).toBe(200);
    expect(one.body.sku).toBe("ESP-001");
    expect(one.body.active).toBe(1);

    const inactive = await request(server).get("/menu-items/5");
    expect(inactive.status).toBe(200);
    expect(inactive.body.sku).toBe("OLD-001");
    expect(inactive.body.active).toBe(0);
  });
});
