import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 12 ping", () => {
  test("GET /ping returns pong", async () => {
    const server = await app();
    const res = await request(server).get("/ping");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ping: "pong" });
  });
});
