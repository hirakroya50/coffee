import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 15 readiness", () => {
  test("GET /ready returns ready true", async () => {
    const server = await app();
    const res = await request(server).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ready: true });
  });
});
