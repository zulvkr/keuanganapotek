import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
});

function setup() {
  const client = createSqliteClient(":memory:");
  clients.push(client);
  runMigrations(client.sqlite);
  seedAccounts(client);
  return createApiApp(client);
}

const json = { "content-type": "application/json" };

async function postJournal(
  api: ReturnType<typeof createApiApp>,
  entryDate: string,
  lines: unknown[],
) {
  const response = await api.request("http://localhost/api/journals/general", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ entryDate, lines }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{
    data: { journal: { id: string }; lines: Array<{ id: string }> };
  }>;
}

describe("Phase 5 financial reports and drill-down", () => {
  it("calculates comparative income statement with gross and net profit", async () => {
    const api = setup();
    await postJournal(api, "2026-08-10", [
      { accountId: "coa-1101", debit: "800000", credit: "0" },
      { accountId: "coa-4101", debit: "0", credit: "800000" },
    ]);
    await postJournal(api, "2026-08-10", [
      { accountId: "coa-5101", debit: "300000", credit: "0" },
      { accountId: "coa-1301", debit: "0", credit: "300000" },
    ]);
    await postJournal(api, "2026-08-10", [
      { accountId: "coa-6101", debit: "50000", credit: "0" },
      { accountId: "coa-1101", debit: "0", credit: "50000" },
    ]);
    await postJournal(api, "2026-09-10", [
      { accountId: "coa-1101", debit: "1000000", credit: "0" },
      { accountId: "coa-4101", debit: "0", credit: "1000000" },
    ]);
    await postJournal(api, "2026-09-10", [
      { accountId: "coa-5101", debit: "400000", credit: "0" },
      { accountId: "coa-1301", debit: "0", credit: "400000" },
    ]);
    await postJournal(api, "2026-09-10", [
      { accountId: "coa-6101", debit: "100000", credit: "0" },
      { accountId: "coa-1101", debit: "0", credit: "100000" },
    ]);

    const response = await api.request(
      "http://localhost/api/reports/income-statement?periodStart=2026-09-01&periodEnd=2026-09-30&compareStartDate=2026-08-01&compareEndDate=2026-08-31",
    );
    expect(response.status).toBe(200);
    const report = (
      (await response.json()) as {
        data: {
          revenue: { amount: number; compareAmount: number };
          cogs: { amount: number };
          grossProfit: { amount: number };
          netProfit: { amount: number; compareAmount: number };
        };
      }
    ).data;
    expect(report.revenue.amount).toBe(100_000_000);
    expect(report.revenue.compareAmount).toBe(80_000_000);
    expect(report.cogs.amount).toBe(40_000_000);
    expect(report.grossProfit.amount).toBe(60_000_000);
    expect(report.netProfit.amount).toBe(50_000_000);
    expect(report.netProfit.compareAmount).toBe(45_000_000);
  });

  it("keeps the balance sheet equation true and returns a balanced trial balance", async () => {
    const api = setup();
    const opening = await api.request("http://localhost/api/opening-balances/save", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        cutoffDate: "2026-01-01",
        lines: [
          { accountId: "coa-1101", debitAmount: "1000000", creditAmount: "0" },
          { accountId: "coa-3101", debitAmount: "0", creditAmount: "1000000" },
        ],
      }),
    });
    expect(opening.status).toBe(200);
    expect(
      (
        await api.request("http://localhost/api/opening-balances/lock", {
          method: "POST",
          headers: json,
          body: JSON.stringify({ cutoffDate: "2026-01-01" }),
        })
      ).status,
    ).toBe(200);
    await postJournal(api, "2026-01-02", [
      { accountId: "coa-1101", debit: "500000", credit: "0" },
      { accountId: "coa-4101", debit: "0", credit: "500000" },
    ]);

    const balanceResponse = await api.request(
      "http://localhost/api/reports/balance-sheet?asOfDate=2026-01-31",
    );
    expect(balanceResponse.status).toBe(200);
    const balance = (
      (await balanceResponse.json()) as {
        data: {
          totalAssets: number;
          totalLiabilities: number;
          totalEquity: number;
          difference: number;
          isBalanced: boolean;
        };
      }
    ).data;
    expect(balance.totalAssets).toBe(balance.totalLiabilities + balance.totalEquity);
    expect(balance.difference).toBe(0);
    expect(balance.isBalanced).toBe(true);

    const trialResponse = await api.request(
      "http://localhost/api/reports/trial-balance?startDate=2026-01-01&endDate=2026-01-31",
    );
    expect(trialResponse.status).toBe(200);
    const trial = (
      (await trialResponse.json()) as {
        data: { totalDebit: number; totalCredit: number; isBalanced: boolean };
      }
    ).data;
    expect(trial.totalDebit).toBe(trial.totalCredit);
    expect(trial.isBalanced).toBe(true);
  });

  it("returns the source journal line for an account drill-down", async () => {
    const api = setup();
    await postJournal(api, "2026-09-10", [
      { accountId: "coa-5101", debit: "250000", credit: "0", description: "HPP resep harian" },
      { accountId: "coa-1301", debit: "0", credit: "250000" },
    ]);
    const response = await api.request(
      "http://localhost/api/reports/accounts/coa-5101/journal-drill-down?startDate=2026-09-01&endDate=2026-09-30",
    );
    expect(response.status).toBe(200);
    const result = (
      (await response.json()) as {
        data: {
          account: { code: string };
          entries: Array<{ description: string; debit: number; credit: number }>;
          journals: unknown[];
          totalDebit: number;
        };
      }
    ).data;
    expect(result.account.code).toBe("5101");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      description: "HPP resep harian",
      debit: 25_000_000,
      credit: 0,
    });
    expect(result.journals).toHaveLength(1);
    expect(result.totalDebit).toBe(25_000_000);
  });
});
