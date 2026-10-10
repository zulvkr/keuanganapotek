import { expect, test } from "@playwright/test";

test("manages transaction types with metadata schema builder", async ({ page }) => {
  const accounts = [
    {
      id: "coa-1101",
      code: "1101",
      name: "Kas Toko / Kasir",
      classification: "ASET_LANCAR",
      normalBalance: "DEBIT",
      isActive: true,
    },
    {
      id: "coa-4101",
      code: "4101",
      name: "Pendapatan Penjualan",
      classification: "PENDAPATAN",
      normalBalance: "KREDIT",
      isActive: true,
    },
  ];

  let transactionTypes = [
    {
      id: "type-1",
      code: "TRX-01",
      name: "Penjualan Obat Reguler",
      debitAccountId: "coa-1101",
      creditAccountId: "coa-4101",
      description: "Penjualan obat bebas dan resep",
      metadataSchema: [],
      isActive: true,
    },
  ];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/transaction-types*", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { data: transactionTypes } });
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const created = { id: "type-2", ...body };
      transactionTypes.push(created);
      return route.fulfill({ status: 201, json: { data: created } });
    }
    return route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Master Transaksi" }).click();
  await expect(page.getByRole("heading", { name: "Master Tipe Transaksi" })).toBeVisible();

  // Open modal
  await page.getByRole("button", { name: "Tambah Tipe Transaksi" }).click();
  await expect(page.getByRole("heading", { name: "Tambah Tipe Transaksi Baru" })).toBeVisible();

  // Fill form
  const nameInput = page.getByPlaceholder("Penjualan Tunai Kasir");
  await nameInput.fill("Penerimaan Lainnya");

  // Add field in MetadataSchemaBuilder
  await page.getByRole("button", { name: "Tambah Field" }).click();
  await expect(page.getByText("1 field")).toBeVisible();

  // Test live preview tab
  await page.getByRole("button", { name: "Live Preview" }).click();
  await expect(page.getByText("Pratinjau Tampilan Form Popover")).toBeVisible();

  // Switch back to editor
  await page.getByRole("button", { name: "Editor Skema" }).click();

  // Save transaction type
  await page.getByRole("button", { name: "Simpan Tipe Transaksi" }).click();
  await expect(page.getByText("Tipe transaksi baru berhasil dibuat.")).toBeVisible();
});

test("creates and saves a transaction row in Buku Transaksi with 9 cash bank columns", async ({
  page,
}) => {
  const accounts = [
    {
      id: "coa-1101",
      code: "1101",
      name: "Kas Toko / Kasir",
      classification: "ASET_LANCAR",
      normalBalance: "DEBIT",
      isActive: true,
    },
    {
      id: "coa-4101",
      code: "4101",
      name: "Pendapatan Penjualan",
      classification: "PENDAPATAN",
      normalBalance: "KREDIT",
      isActive: true,
    },
  ];

  const transactionTypes = [
    {
      id: "type-1",
      code: "TRX-01",
      name: "Penjualan Tunai Kasir",
      debitAccountId: "coa-1101",
      creditAccountId: "coa-4101",
      metadataSchema: [
        {
          key: "shift",
          label: "Shift Kasir",
          type: "text",
          required: false,
        },
      ],
      isActive: true,
    },
  ];

  const summaryData = {
    totalTransactions: 0,
    totalAmount: 0,
    accounts: [
      { code: "1101", name: "Kas Toko", balance: 50000000 },
      { code: "1102", name: "Tunai Kasir", balance: 0 },
      { code: "1103", name: "Bank Jago", balance: 0 },
      { code: "1104", name: "Shopee", balance: 0 },
      { code: "1105", name: "Blibli", balance: 0 },
      { code: "1106", name: "Grab", balance: 0 },
      { code: "1107", name: "QRIS DANA", balance: 0 },
      { code: "1108", name: "Sav. Gaji", balance: 0 },
      { code: "1109", name: "Sav. Sewa", balance: 0 },
    ],
  };

  let transactionsList: any[] = [];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/transaction-types*", (route) =>
    route.fulfill({ json: { data: transactionTypes } }),
  );
  await page.route("**/api/transactions/summary*", (route) =>
    route.fulfill({ json: { data: summaryData } }),
  );
  await page.route("**/api/transactions*", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { data: transactionsList } });
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const newTx = {
        id: "tx-1",
        transactionNo: "TRX-202610-0001",
        transactionDate: body.transactionDate,
        transactionTypeId: body.transactionTypeId,
        transactionTypeCode: "TRX-01",
        transactionTypeName: "Penjualan Tunai Kasir",
        debitAccountId: "coa-1101",
        debitAccountCode: "1101",
        debitAccountName: "Kas Toko / Kasir",
        creditAccountId: "coa-4101",
        creditAccountCode: "4101",
        creditAccountName: "Pendapatan Penjualan",
        amount: body.amount,
        memo: body.memo,
        metadata: body.metadata,
        journalId: "j-1",
        runningBalances: {
          "1101": 55000000,
        },
        mutations: {
          "1101": body.amount,
        },
      };
      transactionsList = [newTx];
      return route.fulfill({ status: 201, json: { data: newTx } });
    }
    return route.continue();
  });

  await page.goto("/transaksi");
  await expect(page.getByRole("heading", { name: "Buku Transaksi" })).toBeVisible();

  // Verify 9 cash & bank columns / summary cards
  await expect(page.getByText("1101 Tukaran").first()).toBeVisible();
  await expect(page.getByText("1109 Sav. Sewa").first()).toBeVisible();

  // Click Baris Baru
  await page.getByRole("button", { name: "Baris Baru" }).click();

  // Fill amount and memo
  const amountInput = page.getByPlaceholder("0,00").first();
  await amountInput.fill("50000");

  const memoInput = page.getByPlaceholder("Keterangan...").first();
  await memoInput.fill("Penjualan shift pagi");

  // Open metadata popover
  await page.getByRole("button", { name: "+ Metadata" }).click();
  await expect(page.getByText("Metadata: Penjualan Tunai Kasir")).toBeVisible();

  // Fill metadata field
  const shiftInput = page.getByPlaceholder("Masukkan shift kasir");
  if (await shiftInput.isVisible()) {
    await shiftInput.fill("Pagi");
  }
  await page.getByRole("button", { name: "Terapkan Metadata" }).click();

  // Save row
  await page.getByTitle("Simpan baris transaksi").click();

  // Verify success message
  await expect(page.getByText("Transaksi berhasil disimpan.")).toBeVisible();
});
