import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";
import { accounts, journalLines, journals, openingBalances } from "../db/schema/index.js";
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
    const tables = client.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(["accounts", "opening_balances", "journals", "journal_lines"]),
    );
    expect(client.db.select().from(journals).all()).toHaveLength(0);
    expect(
      (client.sqlite.prepare("SELECT count(*) AS count FROM accounts").get() as { count: number })
        .count,
    ).toBeGreaterThanOrEqual(30);
    expect(
      client.db.select().from(accounts).where(eq(accounts.code, "1104")).get(),
    ).toBeUndefined();
    expect(
      client.db.select().from(accounts).where(eq(accounts.code, "1105")).get(),
    ).toBeUndefined();
    expect(client.db.select().from(accounts).where(eq(accounts.code, "1201")).get()?.name).toBe(
      "Dana Pending + Saldo Shopee",
    );
    expect(client.db.select().from(accounts).where(eq(accounts.code, "1203")).get()?.name).toBe(
      "Dana Pending + Saldo Blibli",
    );
    expect(client.db.select().from(openingBalances).all()).toHaveLength(0);
  });

  it("protects system groups and prevents them from receiving balances or journals", async () => {
    const { api } = setup();
    expect(
      (await api.request("http://localhost/api/accounts/coa-1000", { method: "DELETE" })).status,
    ).toBe(409);
    const deleteRetained = await api.request("http://localhost/api/accounts/coa-3201", {
      method: "DELETE",
    });
    expect(deleteRetained.status).toBe(409);
    expect((await deleteRetained.json()).error).toMatch(/laba ditahan/i);
    const opening = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cutoffDate: "2026-01-01",
        lines: [
          { accountId: "coa-1000", debitAmount: "1000000", creditAmount: "0" },
          { accountId: "coa-3101", debitAmount: "0", creditAmount: "1000000" },
        ],
      }),
    });
    expect(opening.status).toBe(409);
    const journal = await api.request("http://localhost/api/journals/general", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryDate: "2026-01-02",
        lines: [
          { accountId: "coa-1000", debit: "1000000", credit: "0" },
          { accountId: "coa-4101", debit: "0", credit: "1000000" },
        ],
      }),
    });
    expect(journal.status).toBe(409);
  });

  it("adds the debit/credit difference to opening balance equity", () => {
    const adjusted = autoBalanceOpeningBalances(
      [
        { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
        { accountId: "coa-3101", debitAmount: "0", creditAmount: "0" },
      ],
      "coa-3101",
    );
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
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines }),
    });
    expect(rejected.status).toBe(400);
    expect(client.db.select().from(openingBalances).all()).toHaveLength(0);

    const balancedLines = autoBalanceOpeningBalances(lines, "coa-3101");
    const saved = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines: balancedLines }),
    });
    expect(saved.status).toBe(200);

    const locked = await api.request("http://localhost/api/opening-balances/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01" }),
    });
    expect(locked.status).toBe(200);
    expect(client.db.select().from(journals).all()).toHaveLength(1);
    const journal = client.db
      .select()
      .from(journals)
      .where(eq(journals.sourceModule, "OPENING_BALANCE"))
      .get();
    expect(journal?.sourceId).toBe("2026-01-01");
    const postedLines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, journal!.id))
      .all();
    expect(postedLines.reduce((sum, line) => sum + line.debit, 0)).toBe(100000000);
    expect(postedLines.reduce((sum, line) => sum + line.credit, 0)).toBe(100000000);
    expect(
      client.db
        .select()
        .from(openingBalances)
        .all()
        .every((row) => row.isLocked),
    ).toBe(true);
  });

  it("allows updating opening balances after being locked and syncs the opening journal lines", async () => {
    const { api, client } = setup();
    const initialLines = [
      { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "1000000" },
    ];
    await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines: initialLines }),
    });
    await api.request("http://localhost/api/opening-balances/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01" }),
    });

    const updatedLines = [
      { accountId: "coa-1101", debitAmount: "2500000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "2500000" },
    ];
    const updateRes = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines: updatedLines }),
    });
    expect(updateRes.status).toBe(200);

    const lockRes = await api.request("http://localhost/api/opening-balances/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01" }),
    });
    expect(lockRes.status).toBe(200);

    const journal = client.db
      .select()
      .from(journals)
      .where(eq(journals.sourceModule, "OPENING_BALANCE"))
      .get();
    const postedLines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, journal!.id))
      .all();
    expect(postedLines.reduce((sum, line) => sum + line.debit, 0)).toBe(250_000_000);
    expect(postedLines.reduce((sum, line) => sum + line.credit, 0)).toBe(250_000_000);
  });

  it("returns opening balance plus posted movements without counting the opening journal twice", async () => {
    const { api } = setup();
    const openingLines = [
      { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "1000000" },
    ];
    await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines: openingLines }),
    });
    await api.request("http://localhost/api/opening-balances/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01" }),
    });
    await api.request("http://localhost/api/journals/general", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryDate: "2026-01-02",
        lines: [
          { accountId: "coa-1101", debit: "500000", credit: "0" },
          { accountId: "coa-4101", debit: "0", credit: "500000" },
        ],
      }),
    });

    const response = await api.request(
      "http://localhost/api/opening-balances?cutoffDate=2026-01-01",
    );
    const payload = (await response.json()) as {
      data: Array<{ accountId: string; runningBalance: number }>;
    };
    expect(payload.data.find((row) => row.accountId === "coa-1101")?.runningBalance).toBe(
      150_000_000,
    );
    expect(payload.data.find((row) => row.accountId === "coa-3101")?.runningBalance).toBe(
      100_000_000,
    );
    expect(payload.data.find((row) => row.accountId === "coa-4101")?.runningBalance).toBe(
      50_000_000,
    );
  });

  it("moves an unlocked opening-balance draft when its cut-off date changes", async () => {
    const { api, client } = setup();
    const lines = [
      { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "1000000" },
    ];
    const first = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-01-01", lines }),
    });
    expect(first.status).toBe(200);

    const second = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-02-01", lines }),
    });
    expect(second.status).toBe(200);
    expect(
      client.db
        .select()
        .from(openingBalances)
        .all()
        .every((row) => row.cutoffDate === "2026-02-01"),
    ).toBe(true);

    const locked = await api.request("http://localhost/api/opening-balances/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-02-01" }),
    });
    expect(locked.status).toBe(200);

    const rejected = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoffDate: "2026-03-01", lines }),
    });
    expect(rejected.status).toBe(409);

    const moved = await api.request("http://localhost/api/opening-balances/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromDate: "2026-02-01", toDate: "2026-03-01" }),
    });
    expect(moved.status).toBe(200);
    expect(
      client.db
        .select({ cutoffDate: openingBalances.cutoffDate, isLocked: openingBalances.isLocked })
        .from(openingBalances)
        .all()
        .every((row) => row.cutoffDate === "2026-03-01" && row.isLocked),
    ).toBe(true);
    expect(
      client.db
        .select({ entryDate: journals.entryDate, sourceId: journals.sourceId })
        .from(journals)
        .where(eq(journals.sourceModule, "OPENING_BALANCE"))
        .get(),
    ).toEqual({ entryDate: "2026-03-01", sourceId: "2026-03-01" });
  });

  it("preserves user-created custom accounts and retains deactivated status across seedAccounts calls", () => {
    const { client } = setup();

    // 1. User inserts a custom CoA
    client.db
      .insert(accounts)
      .values({
        id: "coa-custom-6115",
        code: "6115",
        name: "Beban Pelatihan Karyawan Baru",
        parentId: "coa-6100",
        classification: "BEBAN_OPERASIONAL",
        normalBalance: "DEBIT",
        level: 3,
        isGroup: false,
        isActive: true,
      })
      .run();

    // 2. User explicitly deactivates a standard account (e.g., Grab Merchant 1106)
    client.db.update(accounts).set({ isActive: false }).where(eq(accounts.code, "1106")).run();

    // 3. Redeploy triggers re-seed
    seedAccounts(client);

    // 4. Custom account must still be present and active
    const custom = client.db.select().from(accounts).where(eq(accounts.code, "6115")).get();
    expect(custom).toBeDefined();
    expect(custom?.isActive).toBe(true);
    expect(custom?.parentId).toBe("coa-6100");

    // 5. Deactivated standard account must remain inactive
    const deactivated = client.db.select().from(accounts).where(eq(accounts.code, "1106")).get();
    expect(deactivated).toBeDefined();
    expect(deactivated?.isActive).toBe(false);
  });
});
