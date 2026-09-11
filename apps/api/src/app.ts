import { Hono } from "hono";
import type { HealthResponse } from "@keuangan-apotek/shared";

export const app = new Hono();

app.get("/health", (context) => {
  const response: HealthResponse = {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
  return context.json(response);
});

app.notFound((context) => context.json({ error: "Not found" }, 404));
