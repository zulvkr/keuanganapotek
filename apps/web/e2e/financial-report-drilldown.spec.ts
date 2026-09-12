import { expect, test } from "@playwright/test";

const incomeReport = {
  period: { startDate: "2026-09-01", endDate: "2026-09-30" },
  comparePeriod: { startDate: "2026-08-01", endDate: "2026-08-31" },
  sections: [
    {
      key: "REVENUE",
      label: "Pendapatan Penjualan",
      rows: [
        {
          accountId: "coa-4101",
          code: "4101",
          name: "Pendapatan Penjualan Obat Bebas (OTC)",
          classification: "PENDAPATAN",
          amount: 100000000,
          compareAmount: 80000000,
          variance: 20000000,
          growthPercent: 25,
        },
      ],
      total: { amount: 100000000, compareAmount: 80000000, variance: 20000000, growthPercent: 25 },
    },
    {
      key: "COGS",
      label: "HPP Obat",
      rows: [
        {
          accountId: "coa-5101",
          code: "5101",
          name: "HPP Obat Resep",
          classification: "BEBAN_POKOK",
          amount: 40000000,
          compareAmount: 30000000,
          variance: 10000000,
          growthPercent: 33.33,
        },
      ],
      total: {
        amount: 40000000,
        compareAmount: 30000000,
        variance: 10000000,
        growthPercent: 33.33,
      },
    },
    {
      key: "OPERATING_EXPENSES",
      label: "Beban Operasional",
      rows: [],
      total: { amount: 0, compareAmount: 0, variance: 0, growthPercent: 0 },
    },
    {
      key: "NON_OPERATING_EXPENSES",
      label: "Beban Non-Operasional",
      rows: [],
      total: { amount: 0, compareAmount: 0, variance: 0, growthPercent: 0 },
    },
  ],
  revenue: { amount: 100000000, compareAmount: 80000000, variance: 20000000, growthPercent: 25 },
  cogs: { amount: 40000000, compareAmount: 30000000, variance: 10000000, growthPercent: 33.33 },
  grossProfit: { amount: 60000000, compareAmount: 50000000, variance: 10000000, growthPercent: 20 },
  operatingExpenses: { amount: 0, compareAmount: 0, variance: 0, growthPercent: 0 },
  nonOperatingExpenses: { amount: 0, compareAmount: 0, variance: 0, growthPercent: 0 },
  netProfit: { amount: 60000000, compareAmount: 50000000, variance: 10000000, growthPercent: 20 },
};

test("opens the journal drill-down drawer from a financial report amount", async ({ page }) => {
  await page.route("**/api/reports/income-statement*", (route) =>
    route.fulfill({ json: { data: incomeReport } }),
  );
  await page.route("**/api/reports/accounts/coa-5101/journal-drill-down*", (route) =>
    route.fulfill({
      json: {
        data: {
          account: { code: "5101", name: "HPP Obat Resep" },
          entries: [
            {
              lineId: "line-1",
              journalNo: "JU-202609-0001",
              entryDate: "2026-09-10",
              referenceNo: "POS-2026-09-10",
              memo: "POS Clearing",
              sourceModule: "POS_CLEARING",
              description: "HPP resep harian",
              debit: 40000000,
              credit: 0,
            },
          ],
          journals: [{ journalId: "journal-1" }],
          totalDebit: 40000000,
          totalCredit: 0,
        },
      },
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Laporan Keuangan" }).click();
  await expect(page.locator("h2", { hasText: "Laporan Keuangan" })).toBeVisible();
  await page.getByRole("button", { name: /Rp 400\.000,00/ }).click();
  await expect(page.getByRole("dialog", { name: "Rincian jurnal akun" })).toBeVisible();
  await expect(page.getByText("JU-202609-0001")).toBeVisible();
  await expect(page.getByText("POS_CLEARING")).toBeVisible();
});
