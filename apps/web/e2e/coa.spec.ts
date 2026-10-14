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
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await expect(page.getByRole("heading", { name: "Bagan Akun" })).toBeVisible();

  const deleteRequest = page.waitForRequest(
    (request) => request.method() === "DELETE" && request.url().endsWith("/api/accounts/coa-9999"),
  );
  await page.getByRole("button", { name: "Hapus 9999" }).click();
  await deleteRequest;
  await expect(page.getByRole("button", { name: "Hapus 9999" })).toHaveCount(0);
});

test("disables deletion for Laba Ditahan account", async ({ page }) => {
  const accounts = [
    {
      id: "coa-3201",
      code: "3201",
      name: "Laba ditahan",
      parentId: null,
      classification: "EKUITAS",
      normalBalance: "KREDIT",
      level: 3,
      isGroup: false,
      isActive: true,
    },
  ];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/opening-balances/meta", (route) =>
    route.fulfill({ json: { data: { cutoffDate: null } } }),
  );
  await page.route("**/api/opening-balances?*", (route) => route.fulfill({ json: { data: [] } }));

  await page.goto("/");
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await expect(page.getByRole("heading", { name: "Bagan Akun" })).toBeVisible();

  const deleteButton = page.getByRole("button", { name: "Hapus 3201" });
  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toBeDisabled();
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
  await page.route("**/api/opening-balances/save", async (route) => {
    await route.fulfill({ json: { data: { saved: true, cutoffDate } } });
  });
  await page.route("**/api/opening-balances/lock", async (route) => {
    await route.fulfill({
      json: { data: { locked: true, journal: { journalNo: "JU-202609-0002" } } },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await page.getByRole("tab", { name: "Input Saldo Awal" }).click();
  const dateInput = page.getByLabel("Tanggal saldo awal");
  await expect(dateInput).toBeEnabled();
  await dateInput.fill("2026-09-13");
  await page.getByRole("button", { name: "Simpan Saldo Awal" }).click();
  await expect(page.getByText("Saldo awal berhasil disimpan.")).toBeVisible();
});

test("enables only the normal balance side (debit or credit) for opening balance inputs", async ({
  page,
}) => {
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
      id: "coa-2101",
      code: "2101",
      name: "Utang Usaha PBF",
      parentId: null,
      classification: "KEWAJIBAN_LANCAR",
      normalBalance: "KREDIT",
      level: 1,
      isGroup: false,
      isActive: true,
    },
  ];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/opening-balances/meta", (route) =>
    route.fulfill({ json: { data: { cutoffDate: "2026-09-12" } } }),
  );
  await page.route("**/api/opening-balances?*", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            accountId: "coa-1101",
            debitAmount: 500_000,
            creditAmount: 0,
            runningBalance: 500_000,
            isGroup: false,
            isLocked: false,
            notes: null,
          },
          {
            accountId: "coa-2101",
            debitAmount: 0,
            creditAmount: 500_000,
            runningBalance: 500_000,
            isGroup: false,
            isLocked: false,
            notes: null,
          },
        ],
      },
    }),
  );
  await page.route("**/api/accounts/coa-1101", (route) =>
    route.fulfill({ json: { data: { ...accounts[0], normalBalance: "KREDIT" } } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await page.getByRole("tab", { name: "Input Saldo Awal" }).click();

  const debitKas = page.getByLabel("Debit 1101");
  const kreditKas = page.getByLabel("Kredit 1101");
  const debitUtang = page.getByLabel("Debit 2101");
  const kreditUtang = page.getByLabel("Kredit 2101");

  // For DEBIT account (1101): Debit is enabled, Kredit is disabled
  await expect(debitKas).toBeEnabled();
  await expect(kreditKas).toBeDisabled();
  await expect(kreditKas).toHaveValue("0,00");

  // For KREDIT account (2101): Kredit is enabled, Debit is disabled
  await expect(kreditUtang).toBeEnabled();
  await expect(debitUtang).toBeDisabled();
  await expect(debitUtang).toHaveValue("0,00");

  // Switching Saldo Normal of 1101 to KREDIT
  await page.getByLabel("Saldo normal 1101").selectOption("KREDIT");
  await expect(debitKas).toBeDisabled();
  await expect(kreditKas).toBeEnabled();
  await expect(kreditKas).toHaveValue("5.000,00");
  await expect(debitKas).toHaveValue("0,00");
});
