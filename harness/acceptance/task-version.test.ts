import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

async function app() {
  return createApp(await createFreshDatabase());
}

describe("task 13 version", () => {
  test("GET /version returns package version", async () => {
    const server = await app();
    const res = await request(server).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: "0.0.0" });
  });
});
