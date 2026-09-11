import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";
import { journalLines, journals, openingBalances } from "../db/schema/index.js";
import { autoBalanceOpeningBalances } from "../services/opening-balance.service.js";
import { eq } from "drizzle-orm";

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

describe("Phase 1 database and opening balance flow", () => {
  it("migrates the accounting tables and seeds the standard pharmacy CoA", () => {
    const { client } = setup();
    const tables = client.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining(["accounts", "opening_balances", "journals", "journal_lines"]));
    expect(client.db.select().from(journals).all()).toHaveLength(0);
    expect((client.sqlite.prepare("SELECT count(*) AS count FROM accounts").get() as { count: number }).count).toBeGreaterThanOrEqual(30);
    expect(client.db.select().from(openingBalances).all()).toHaveLength(0);
  });

  it("adds the debit/credit difference to opening balance equity", () => {
    const adjusted = autoBalanceOpeningBalances([
      { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "0" },
    ], "coa-3101");
    const equity = adjusted.find((line) => line.accountId === "coa-3101");
    expect(equity).toMatchObject({ debitAmount: "0", creditAmount: "1000000" });
  });

  it("rejects an unbalanced save, then creates one balanced opening journal when locked", async () => {
    const { api, client } = setup();
    const lines = [
      { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "900000" },
    ];
    const rejected = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines }),
    });
    expect(rejected.status).toBe(400);
    expect(client.db.select().from(openingBalances).all()).toHaveLength(0);

    const balancedLines = autoBalanceOpeningBalances(lines, "coa-3101");
    const saved = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines: balancedLines }),
    });
    expect(saved.status).toBe(200);

    const locked = await api.request("http://localhost/api/opening-balances/lock", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01" }),
    });
    expect(locked.status).toBe(200);
    expect(client.db.select().from(journals).all()).toHaveLength(1);
    const journal = client.db.select().from(journals).where(eq(journals.sourceModule, "OPENING_BALANCE")).get();
    expect(journal?.sourceId).toBe("2026-01-01");
    const postedLines = client.db.select().from(journalLines).where(eq(journalLines.journalId, journal!.id)).all();
    expect(postedLines.reduce((sum, line) => sum + line.debit, 0)).toBe(100000000);
    expect(postedLines.reduce((sum, line) => sum + line.credit, 0)).toBe(100000000);
    expect(client.db.select().from(openingBalances).all().every((row) => row.isLocked)).toBe(true);
  });
});
