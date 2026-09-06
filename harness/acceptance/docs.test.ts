import request from "supertest";
import { createApp } from "../../src/app";
import { createFreshDatabase } from "../../src/db";

describe("OpenAPI documentation", () => {
  test("serves swagger ui, redoc, and the spec files", async () => {
    const server = createApp(await createFreshDatabase());

    const swagger = await request(server).get("/docs/");
    expect(swagger.status).toBe(200);
    expect(swagger.text).toMatch(/swagger/i);

    const redoc = await request(server).get("/redoc");
    expect(redoc.status).toBe(200);
    expect(redoc.text).toMatch(/redoc/i);

    const yaml = await request(server).get("/openapi.yaml");
    expect(yaml.status).toBe(200);
    expect(yaml.text).toContain("operationId: listMenuItems");

    const json = await request(server).get("/openapi.json");
    expect(json.status).toBe(200);
    expect(json.body.paths["/menu-items"].get.operationId).toBe("listMenuItems");
  });
});
