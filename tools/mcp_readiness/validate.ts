import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const spec = parse(
  fs.readFileSync(path.resolve(__dirname, "../../openapi.yaml"), "utf8")
) as Record<string, unknown>;
const schemas = ((spec.components as Record<string, unknown>)?.schemas ?? {}) as Record<
  string,
  unknown
>;
const methods = ["get", "post", "put", "patch", "delete"];
const errors: string[] = [];

function schemaName(node: unknown): string | undefined {
  const ref = (node as { content?: Record<string, { schema?: { $ref?: string } }> })
    ?.content?.["application/json"]?.schema?.$ref;
  return ref?.startsWith("#/components/schemas/")
    ? ref.slice("#/components/schemas/".length)
    : undefined;
}

for (const [route, item] of Object.entries((spec.paths ?? {}) as Record<string, any>)) {
  for (const method of methods) {
    const op = item?.[method];
    if (!op) continue;
    const id = `${method.toUpperCase()} ${route}`;
    if (!op.operationId) errors.push(`${id} missing operationId`);
    if (!op.description) errors.push(`${id} missing description`);
    if (!op.responses) errors.push(`${id} missing responses`);
    const ok = Object.keys(op.responses ?? {}).find((c) => c.startsWith("2"));
    const okName = ok ? schemaName(op.responses[ok]) : undefined;
    if (!okName || !schemas[okName]) errors.push(`${id} missing success schema`);
    if (op.requestBody) {
      const reqName = schemaName(op.requestBody);
      if (!reqName || !schemas[reqName]) errors.push(`${id} missing request schema`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("openapi mcp-ready");
