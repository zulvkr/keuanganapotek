import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";
import { bankReconMatches, bankStatements, journals } from "../db/schema/index.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];
afterEach(() => { for (const client of clients.splice(0)) client.sqlite.close(); });
function setup() { const client = createSqliteClient(":memory:"); clients.push(client); runMigrations(client.sqlite); seedAccounts(client); return { client, api: createApiApp(client) }; }
const json = { "content-type": "application/json" };

describe("Phase 4 bank reconciliation", () => {
  it("imports a CSV and auto-matches an identical bank movement within one calendar day", async () => {
    const { api, client } = setup();
    const transfer = await api.request("http://localhost/api/cash-bank/transfers", { method: "POST", headers: json, body: JSON.stringify({ transactionTime: "2026-09-10T09:00", transactionType: "DEPOSIT", sourceAccountId: "coa-1101", targetAccountId: "coa-1111", netAmount: "100.000", adminFee: "0" }) });
    expect(transfer.status).toBe(201);
    const imported = await api.request("http://localhost/api/bank-recon/import", { method: "POST", headers: json, body: JSON.stringify({ bankAccountId: "coa-1111", csv: "Tanggal,Keterangan,Debit,Kredit\n11/09/2026,Setoran kasir,0,100.000" }) });
    expect(imported.status).toBe(201);
    const matched = await api.request("http://localhost/api/bank-recon/auto-match", { method: "POST", headers: json, body: JSON.stringify({ bankAccountId: "coa-1111" }) });
    expect(matched.status).toBe(200);
    expect((await matched.json() as { data: { matchedCount: number } }).data.matchedCount).toBe(1);
    expect(client.db.select().from(bankReconMatches).get()?.matchType).toBe("AUTO");
    expect(client.db.select().from(bankStatements).get()?.isMatched).toBe(true);
  });

  it("allows manual matching when the dates are more than one day apart", async () => {
    const { api, client } = setup();
    await api.request("http://localhost/api/cash-bank/transfers", { method: "POST", headers: json, body: JSON.stringify({ transactionTime: "2026-09-01T09:00", transactionType: "DEPOSIT", sourceAccountId: "coa-1101", targetAccountId: "coa-1111", netAmount: "50.000", adminFee: "0" }) });
    await api.request("http://localhost/api/bank-recon/import", { method: "POST", headers: json, body: JSON.stringify({ bankAccountId: "coa-1111", rows: [{ statementDate: "2026-09-05", description: "Setoran terlambat", debit: "0", credit: "50.000" }] }) });
    const auto = await api.request("http://localhost/api/bank-recon/auto-match", { method: "POST", headers: json, body: JSON.stringify({ bankAccountId: "coa-1111" }) });
    expect((await auto.json() as { data: { matchedCount: number } }).data.matchedCount).toBe(0);
    const before = await api.request("http://localhost/api/bank-recon?bankAccountId=coa-1111");
    const beforeBody = await before.json() as { data: { statements: Array<{ id: string }>; internal: Array<{ journalLineId: string }> } };
    const manual = await api.request("http://localhost/api/bank-recon/matches", { method: "POST", headers: json, body: JSON.stringify({ bankStatementId: beforeBody.data.statements[0]!.id, journalLineId: beforeBody.data.internal[0]!.journalLineId }) });
    expect(manual.status).toBe(201);
    expect(client.db.select().from(bankReconMatches).get()?.matchType).toBe("MANUAL");
    expect(client.db.select().from(journals).where(eq(journals.sourceModule, "CASH_BANK")).all()).toHaveLength(1);
  });
});
