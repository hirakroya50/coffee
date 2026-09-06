import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import redoc from "redoc-express";
import { parse } from "yaml";

const specPath = path.resolve(__dirname, "../openapi.yaml");

export function loadOpenApiSpec(): Record<string, unknown> {
  return parse(fs.readFileSync(specPath, "utf8")) as Record<string, unknown>;
}

export function registerDocsRoutes(app: Express): void {
  const spec = loadOpenApiSpec();
  const yamlText = fs.readFileSync(specPath, "utf8");

  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").send(yamlText);
  });

  app.get("/openapi.json", (_req, res) => {
    res.json(spec);
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));

  app.get(
    "/redoc",
    redoc({
      title: "Coffee Shop API",
      specUrl: "/openapi.yaml",
    })
  );
}
