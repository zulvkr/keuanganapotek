import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];
afterEach(() => { for (const client of clients.splice(0)) client.sqlite.close(); });

describe("Phase 6 end-to-end accounting flow", () => {
  it("flows from opening balance through PBF, POS, cash-bank, recon, and reports", async () => {
    const client = createSqliteClient(":memory:");
    clients.push(client);
    runMigrations(client.sqlite);
    seedAccounts(client);
    const api = createApiApp(client);
    const json = { "content-type": "application/json" };
    const request = (path: string, body: unknown) => api.request(`http://localhost${path}`, { method: "POST", headers: json, body: JSON.stringify(body) });

    expect((await request("/api/opening-balances/save", { cutoffDate: "2026-01-01", lines: [
      { accountId: "coa-1101", debitAmount: "10.000.000", creditAmount: "0" },
      { accountId: "coa-3101", debitAmount: "0", creditAmount: "10.000.000" },
    ] })).status).toBe(200);
    expect((await request("/api/opening-balances/lock", { cutoffDate: "2026-01-01" })).status).toBe(200);

    const invoice = await request("/api/pbf-invoices", { invoiceDate: "2026-09-03", dueDate: "2026-10-03", pbfName: "PBF Nusantara", invoiceNumber: "PH6-INV-001", dppAmount: "1.000.000", paymentTerms: "TEMPO_30" });
    expect(invoice.status).toBe(201);

    const pos = await request("/api/pos-clearings", { clearingDate: "2026-09-04", totalPosOmzet: "2.000.000", cashReceived: "1.200.000", nonCashReceived: "800.000", cogsAmount: "1.000.000" });
    expect(pos.status).toBe(201);
    const posId = ((await pos.json()) as { data: { id: string } }).data.id;
    expect((await request(`/api/pos-clearings/${posId}/generate-journal`, {})).status).toBe(200);

    const transfer = await request("/api/cash-bank/transfers", { transactionTime: "2026-09-05T10:00:00+07:00", transactionType: "DEPOSIT", sourceAccountId: "coa-1101", targetAccountId: "coa-1111", netAmount: "500.000", adminFee: "0" });
    expect(transfer.status).toBe(201);

    const imported = await request("/api/bank-recon/import", { bankAccountId: "coa-1111", rows: [{ statementDate: "2026-09-05", description: "Setoran kasir", debit: "0", credit: "500.000" }] });
    expect(imported.status).toBe(201);
    const matched = await request("/api/bank-recon/auto-match", { bankAccountId: "coa-1111" });
    expect(matched.status).toBe(200);
    expect(((await matched.json()) as { data: { matchedCount: number } }).data.matchedCount).toBe(1);

    const income = await api.request("http://localhost/api/reports/income-statement?periodStart=2026-09-01&periodEnd=2026-09-30");
    const balance = await api.request("http://localhost/api/reports/balance-sheet?asOfDate=2026-09-30");
    const trial = await api.request("http://localhost/api/reports/trial-balance?startDate=2026-01-01&endDate=2026-09-30");
    expect(income.status).toBe(200);
    expect(balance.status).toBe(200);
    expect(trial.status).toBe(200);
    expect(((await balance.json()) as { data: { isBalanced: boolean } }).data.isBalanced).toBe(true);
    expect(((await trial.json()) as { data: { isBalanced: boolean } }).data.isBalanced).toBe(true);
  });
});
