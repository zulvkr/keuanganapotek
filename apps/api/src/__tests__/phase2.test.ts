import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";
import { journalLines, journals, openingBalances } from "../db/schema/index.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
});

function setup() {
  const client = createSqliteClient(":memory:");
  clients.push(client);
  runMigrations(client.sqlite);
  seedAccounts(client);
  return { client, api: createApiApp(client) };
}

const balancedEntry = {
  entryDate: "2026-01-15",
  referenceNo: "ADJ-001",
  memo: "Penyesuaian kas",
  lines: [
    { accountId: "coa-1101", description: "Kas bertambah", debit: "1.000.000", credit: "0" },
    { accountId: "coa-4101", description: "Pendapatan lain", debit: "0", credit: "1.000.000" },
  ],
};

describe("Phase 2 double-entry ledger", () => {
  it("rolls back an unbalanced general journal before any row is written", async () => {
    const { api, client } = setup();
    const response = await api.request("http://localhost/api/journals/general", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...balancedEntry, lines: balancedEntry.lines.map((line, index) => index === 1 ? { ...line, credit: "900.000" } : line) }),
    });
    expect(response.status).toBe(400);
    expect(client.db.select().from(journals).all()).toHaveLength(0);
    expect(client.db.select().from(journalLines).all()).toHaveLength(0);
  });

  it("posts balanced lines atomically with a period journal number and valid foreign keys", async () => {
    const { api, client } = setup();
    const response = await api.request("http://localhost/api/journals/general", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(balancedEntry),
    });
    expect(response.status).toBe(201);
    const journal = client.db.select().from(journals).get();
    expect(journal).toMatchObject({ journalNo: "JU-202601-0001", sourceModule: "GENERAL", isPosted: true });
    const lines = client.db.select().from(journalLines).where(eq(journalLines.journalId, journal!.id)).all();
    expect(lines).toHaveLength(2);
    expect(lines.reduce((total, line) => total + line.debit, 0)).toBe(100_000_000);
    expect(lines.reduce((total, line) => total + line.credit, 0)).toBe(100_000_000);
    expect(client.sqlite.prepare("PRAGMA foreign_key_check").all()).toHaveLength(0);
  });

  it("lists, updates, and deletes only general journals while preserving balance", async () => {
    const { api, client } = setup();
    const created = await api.request("http://localhost/api/journals/general", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(balancedEntry),
    });
    const createdPayload = await created.json() as { data: { journal: { id: string } } };
    const id = createdPayload.data.journal.id;
    const listed = await api.request("http://localhost/api/journals?startDate=2026-01-01&endDate=2026-01-31&sourceModule=GENERAL");
    expect(listed.status).toBe(200);
    const listedPayload = await listed.json() as { data: Array<{ lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }> }> };
    expect(listedPayload.data).toHaveLength(1);
    expect(listedPayload.data[0]?.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: "1101", accountName: "Kas Toko / Kasir", debit: 100_000_000, credit: 0 }),
      expect.objectContaining({ accountCode: "4101", credit: 100_000_000, debit: 0 }),
    ]));

    const updated = await api.request(`http://localhost/api/journals/${id}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...balancedEntry, memo: "Penyesuaian diperbarui", lines: [
        { accountId: "coa-1101", debit: "2.000.000", credit: "0" },
        { accountId: "coa-4101", debit: "0", credit: "2.000.000" },
      ] }),
    });
    expect(updated.status).toBe(200);
    expect(client.db.select().from(journalLines).all().map((line) => line.debit)).toContain(200_000_000);

    const deleted = await api.request(`http://localhost/api/journals/${id}`, { method: "DELETE" });
    expect(deleted.status).toBe(204);
    expect(client.db.select().from(journals).all()).toHaveLength(0);
  });

  it("rejects general-journal writes in a locked opening period", async () => {
    const { api, client } = setup();
    client.db.insert(openingBalances).values({ id: "opening-lock", cutoffDate: "2026-01-31", accountId: "coa-1101", debitAmount: 0, creditAmount: 0, isLocked: true }).run();
    const response = await api.request("http://localhost/api/journals/general", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(balancedEntry),
    });
    expect(response.status).toBe(409);
    expect(client.db.select().from(journals).all()).toHaveLength(0);
  });
});
