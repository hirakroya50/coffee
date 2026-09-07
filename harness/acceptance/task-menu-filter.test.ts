import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 8 menu category filter", () => {
  test("filters active menu items by category", async () => {
    const server = await app();
    const drinks = await request(server).get("/menu-items?category=drink");
    expect(drinks.status).toBe(200);
    expect(drinks.body.every((item: { category: string }) => item.category === "drink")).toBe(
      true
    );
    expect(drinks.body.map((item: { id: number }) => item.id).sort()).toEqual([1, 2]);

    const food = await request(server).get("/menu-items?category=food");
    expect(food.status).toBe(200);
    expect(food.body.every((item: { category: string }) => item.category === "food")).toBe(
      true
    );
    expect(food.body.map((item: { id: number }) => item.id).sort()).toEqual([3, 4]);
  });

  test("rejects invalid category query values", async () => {
    const server = await app();
    const bad = await request(server).get("/menu-items?category=snack");
    expect(bad.status).toBe(400);
  });
});
