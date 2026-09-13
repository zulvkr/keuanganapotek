import { expect, test } from "@playwright/test";

test("deletes a leaf CoA account without recursively triggering the mutation", async ({ page }) => {
  let accounts = [
    {
      id: "coa-9999",
      code: "9999",
      name: "Akun Uji",
      parentId: null,
      classification: "ASET_LANCAR",
      normalBalance: "DEBIT",
      level: 1,
      isGroup: false,
      isActive: true,
    },
  ];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/opening-balances/meta", (route) =>
    route.fulfill({ json: { data: { cutoffDate: null } } }),
  );
  await page.route("**/api/opening-balances?*", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/accounts/coa-9999", (route) => {
    accounts = [];
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await expect(page.getByRole("heading", { name: "Bagan Akun & Saldo Awal" })).toBeVisible();

  const deleteRequest = page.waitForRequest(
    (request) => request.method() === "DELETE" && request.url().endsWith("/api/accounts/coa-9999"),
  );
  await page.getByRole("button", { name: "Hapus 9999" }).click();
  await deleteRequest;
  await expect(page.getByRole("button", { name: "Hapus 9999" })).toHaveCount(0);
});

test("updates the opening balance date while keeping a locked balance locked", async ({ page }) => {
  let cutoffDate = "2026-09-12";
  const accounts = [
    {
      id: "coa-1101",
      code: "1101",
      name: "Kas Toko / Kasir",
      parentId: null,
      classification: "ASET_LANCAR",
      normalBalance: "DEBIT",
      level: 1,
      isGroup: false,
      isActive: true,
    },
    {
      id: "coa-3101",
      code: "3101",
      name: "Ekuitas Saldo Awal",
      parentId: null,
      classification: "EKUITAS",
      normalBalance: "KREDIT",
      level: 1,
      isGroup: false,
      isActive: true,
    },
  ];
  const openingBalances = [
    {
      accountId: "coa-1101",
      debitAmount: 1_000_000,
      creditAmount: 0,
      runningBalance: 1_000_000,
      isGroup: false,
      isLocked: true,
      notes: null,
    },
    {
      accountId: "coa-3101",
      debitAmount: 0,
      creditAmount: 1_000_000,
      runningBalance: 1_000_000,
      isGroup: false,
      isLocked: true,
      notes: null,
    },
  ];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/opening-balances/meta", (route) =>
    route.fulfill({ json: { data: { cutoffDate } } }),
  );
  await page.route("**/api/opening-balances?*", (route) =>
    route.fulfill({ json: { data: openingBalances.map((row) => ({ ...row, cutoffDate })) } }),
  );
  await page.route("**/api/opening-balances/move", async (route) => {
    const body = route.request().postDataJSON() as { fromDate: string; toDate: string };
    expect(body).toEqual({ fromDate: "2026-09-12", toDate: "2026-09-13" });
    cutoffDate = body.toDate;
    await route.fulfill({
      json: { data: { moved: true, cutoffDate, journal: { journalNo: "JU-202609-0002" } } },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await page.getByRole("tab", { name: "Input Saldo Awal" }).click();
  const dateInput = page.getByLabel("Tanggal saldo awal");
  await expect(dateInput).toBeEnabled();
  await dateInput.fill("2026-09-13");
  await page.getByRole("button", { name: "Simpan tanggal" }).click();
  await expect(page.getByText("Saldo tetap terkunci.")).toBeVisible();
});
