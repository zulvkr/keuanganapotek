import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { backupDatabase } from "../db/backup.js";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";
import { auditLogs, journals } from "../db/schema/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const client = createSqliteClient(":memory:");
  clients.push(client);
  runMigrations(client.sqlite);
  seedAccounts(client);
  return { client, api: createApiApp(client) };
}

const entry = {
  entryDate: "2026-01-15", referenceNo: "PH6-001", memo: "Audit test",
  lines: [
    { accountId: "coa-1101", debit: "1.000.000", credit: "0" },
    { accountId: "coa-4101", debit: "0", credit: "1.000.000" },
  ],
};

describe("Phase 6 hardening", () => {
  it("locks a period for authorized roles and rejects writes with HTTP 403", async () => {
    const { api, client } = setup();
    const lock = await api.request("http://localhost/api/period-locks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockedThrough: "2026-01-31", actor: "owner-1", role: "OWNER" }),
    });
    expect(lock.status).toBe(201);
    const rejected = await api.request("http://localhost/api/journals/general", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry),
    });
    expect(rejected.status).toBe(403);
    expect((await rejected.json()) as { error: string }).toMatchObject({ error: expect.stringContaining("PERIOD_LOCKED") });
    expect(client.db.select().from(journals).all()).toHaveLength(0);
  });

  it("records journal before/after snapshots and protects unlock with owner role", async () => {
    const { api, client } = setup();
    const created = await api.request("http://localhost/api/journals/general", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry),
    });
    const createdPayload = await created.json() as { data: { journal: { id: string } } };
    const id = createdPayload.data.journal.id;
    const updated = await api.request(`http://localhost/api/journals/${id}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...entry, memo: "Audit updated" }),
    });
    expect(updated.status).toBe(200);
    const logs = client.db.select().from(auditLogs).where(eq(auditLogs.entityId, id)).all();
    expect(logs.map((log) => log.action)).toEqual(["CREATE", "UPDATE"]);
    expect(logs[1]?.beforeData).toContain("Audit test");
    expect(logs[1]?.afterData).toContain("Audit updated");

    const lock = await api.request("http://localhost/api/period-locks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockedThrough: "2026-01-31", actor: "pharmacist", role: "APOTEKER_PENGELOLA" }),
    });
    expect(lock.status).toBe(201);
    const forbiddenUnlock = await api.request("http://localhost/api/period-locks/2026-01-31/unlock", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor: "accountant", role: "AKUNTAN" }),
    });
    expect(forbiddenUnlock.status).toBe(403);
  });

  it("creates and reopens a verified SQLite backup", () => {
    const directory = mkdtempSync(join(tmpdir(), "keuangan-apotek-phase6-"));
    temporaryDirectories.push(directory);
    const source = join(directory, "source.sqlite");
    const destination = join(directory, "backup.sqlite");
    const client = createSqliteClient(source);
    clients.push(client);
    runMigrations(client.sqlite);
    seedAccounts(client);
    const result = backupDatabase(source, destination);
    expect(result.integrity).toBe("ok");
    const restored = createSqliteClient(destination);
    try {
      expect(restored.sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
      expect((restored.sqlite.prepare("SELECT count(*) AS count FROM accounts").get() as { count: number }).count).toBeGreaterThanOrEqual(30);
    } finally {
      restored.sqlite.close();
    }
  });
});
