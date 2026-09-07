import type { Express } from "express";

export function registerPingRoutes(app: Express): void {
  app.get("/ping", (_req, res) => {
    res.json({ ping: "pong" });
  });
}
