import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 14 service info", () => {
  test("GET /info returns coffee-shop v1 payload", async () => {
    const server = await app();
    const res = await request(server).get("/info");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "coffee-shop", api: "v1" });
  });
});
