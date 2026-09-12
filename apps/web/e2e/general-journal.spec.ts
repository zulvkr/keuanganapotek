import { expect, test } from "@playwright/test";

test("adds a journal row from the last credit cell and keeps posting disabled while empty", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jurnal Umum" }).click();
  await expect(page.locator("h2", { hasText: "Jurnal Umum" })).toBeVisible();

  await expect(page.getByRole("button", { name: "1 line" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("columnheader", { name: "Akun debit" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Akun kredit" })).toBeVisible();
  await expect(page.getByLabel("Akun debit jurnal draft")).toHaveCount(1);
  await expect(page.getByLabel("Akun kredit jurnal draft")).toHaveCount(1);

  await page.getByRole("button", { name: "2 line" }).click();
  const creditCells = page.getByRole("textbox", { name: /Kredit baris/ });
  await expect(creditCells).toHaveCount(2);
  await creditCells.last().press("Tab");
  await expect(page.getByRole("textbox", { name: /Kredit baris/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Posting Jurnal" })).toBeDisabled();
});

test("keeps draft metadata inside the journal grid", async ({ page }) => {
  await page.route("**/api/accounts/tree", (route) =>
    route.fulfill({
      json: {
        data: [
          { id: "coa-1101", code: "1101", name: "Kas Toko / Kasir", isActive: true },
          { id: "coa-4101", code: "4101", name: "Pendapatan Penjualan", isActive: true },
        ],
      },
    }),
  );
  await page.route("**/api/journals*", (route) => route.fulfill({ json: { data: [] } }));

  await page.goto("/");
  await page.getByRole("button", { name: "Jurnal Umum" }).click();
  const journalTable = page.locator("table");

  await expect(journalTable.getByLabel("Tanggal jurnal draft")).toHaveCount(1);
  await expect(journalTable.getByLabel("Referensi jurnal draft")).toHaveCount(1);
  await expect(journalTable.getByLabel("Memo jurnal draft")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "1 line" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "2 line" }).click();
  await expect(page.getByLabel("Tanggal jurnal draft")).toHaveCount(1);
  await page.getByRole("button", { name: "1 line" }).click();
  await expect(page.getByLabel("Tanggal jurnal draft")).toHaveCount(1);
});

test("edits a GENERAL journal inline in its table group", async ({ page }) => {
  const journal = {
    id: "journal-1",
    journalNo: "JU-202609-0001",
    entryDate: "2026-09-10",
    referenceNo: "ADJ-001",
    memo: "Penyesuaian kas",
    sourceModule: "GENERAL",
    totalDebit: 100000000,
    totalCredit: 100000000,
    lineCount: 2,
    lines: [
      {
        accountId: "coa-1101",
        accountCode: "1101",
        accountName: "Kas Toko / Kasir",
        description: "Kas bertambah",
        debit: 100000000,
        credit: 0,
      },
      {
        accountId: "coa-4101",
        accountCode: "4101",
        accountName: "Pendapatan Penjualan",
        description: "Pendapatan lain",
        debit: 0,
        credit: 100000000,
      },
    ],
  };
  let updatedMemo = journal.memo;

  await page.route("**/api/accounts/tree", (route) =>
    route.fulfill({
      json: {
        data: [
          { id: "coa-1101", code: "1101", name: "Kas Toko / Kasir", isActive: true },
          { id: "coa-4101", code: "4101", name: "Pendapatan Penjualan", isActive: true },
        ],
      },
    }),
  );
  await page.route("**/api/journals", (route) =>
    route.fulfill({ json: { data: [{ ...journal, memo: updatedMemo }] } }),
  );
  await page.route("**/api/journals/journal-1", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const body = route.request().postDataJSON() as { memo: string };
    updatedMemo = body.memo;
    await route.fulfill({
      json: { data: { journal: { ...journal, memo: updatedMemo }, lines: journal.lines } },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Jurnal Umum" }).click();
  await expect(page.getByText("JU-202609-0001").first()).toBeVisible();
  await page.getByRole("button", { name: "Edit JU-202609-0001" }).click();

  const memo = page.getByLabel("Memo jurnal JU-202609-0001").first();
  await memo.fill("Penyesuaian diperbarui");
  await page.getByRole("button", { name: "Simpan JU-202609-0001" }).click();

  await expect(page.getByText("Jurnal berhasil diperbarui.")).toBeVisible();
  await expect(page.getByText("Penyesuaian diperbarui").first()).toBeVisible();
});
