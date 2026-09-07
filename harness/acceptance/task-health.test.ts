import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 11 health check", () => {
  test("GET /health returns ok coffee-shop payload", async () => {
    const server = await app();
    const res = await request(server).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "coffee-shop" });
  });
});
