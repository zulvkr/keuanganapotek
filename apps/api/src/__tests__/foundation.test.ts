import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { createSqliteClient } from "../db/client.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("API foundation", () => {
  it("responds to the health check", async () => {
    const response = await app.request("http://localhost/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", service: "api" });
  });

  it("configures SQLite for WAL, foreign keys, timeout, and normal sync", () => {
    const directory = mkdtempSync(join(tmpdir(), "keuangan-apotek-"));
    temporaryDirectories.push(directory);
    const client = createSqliteClient(join(directory, "test.sqlite"));
    clients.push(client);

    expect(client.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(client.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(client.sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(client.sqlite.pragma("synchronous", { simple: true })).toBe(1);
  });
});
