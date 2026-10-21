import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts, seedSampleTransactions, seedTransactionTypes } from "../db/seed.js";
import {
  accounts,
  journalLines,
  journals,
  openingBalances,
  transactionTypes,
  transactions,
} from "../db/schema/index.js";
import { getBalanceSheet } from "../services/reports.service.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
});

function setup() {
  const client = createSqliteClient(":memory:");
  clients.push(client);
  runMigrations(client.sqlite);
  seedAccounts(client);
  seedTransactionTypes(client);
  return { client, api: createApiApp(client) };
}

describe("Transaction Types and Daily Transactions Engine", () => {
  it("seeds 4-digit accounts and transaction templates with schemas", () => {
    const { client } = setup();

    const allAccounts = client.db.select().from(accounts).all();
    expect(allAccounts.length).toBeGreaterThanOrEqual(33);

    // Verify all account codes are 4-digit
    for (const acc of allAccounts) {
      expect(acc.code).toMatch(/^\d{4}$/);
    }

    const types = client.db.select().from(transactionTypes).all();
    expect(types.length).toBeGreaterThanOrEqual(38);

    // Verify cash/bank accounts exist
    const cashBankCodes = ["1101", "1102", "1103", "1106", "1107", "1108", "1109"];
    for (const code of cashBankCodes) {
      expect(allAccounts.some((a) => a.code === code)).toBe(true);
    }
    expect(allAccounts.some((a) => a.code === "1104")).toBe(false);
    expect(allAccounts.some((a) => a.code === "1105")).toBe(false);
  });

  it("seeds sample transactions for 2026-07-31 and 2026-08-20 including zero amounts", () => {
    const { client } = setup();
    const seededCount = seedSampleTransactions(client);
    expect(seededCount).toBeGreaterThanOrEqual(10);

    const txRows = client.db.select().from(transactions).all();
    expect(txRows.length).toBe(seededCount);

    // Verify zero amount transaction exists
    const zeroTx = txRows.find((tx) => tx.amount === 0);
    expect(zeroTx).toBeDefined();
    expect(zeroTx?.journalId).toBeNull();

    // Verify non-zero transactions have journals
    const nonZeroTx = txRows.filter((tx) => tx.amount > 0);
    expect(nonZeroTx.every((tx) => Boolean(tx.journalId))).toBe(true);
  });

  it("manages transaction types CRUD and schema validation via API", async () => {
    const { api } = setup();

    // List transaction types
    const listRes = await api.request("http://localhost/api/transaction-types");
    expect(listRes.status).toBe(200);
    const listPayload = (await listRes.json()) as { data: Array<{ id: string; code: string }> };
    expect(listPayload.data.length).toBeGreaterThanOrEqual(38);

    // Create new transaction type
    const createRes = await api.request("http://localhost/api/transaction-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "TRX-CUSTOM",
        name: "Pengeluaran Khusus",
        debitAccountId: "coa-6107",
        creditAccountId: "coa-1103",
        description: "Beban lain-lain via Jago",
        metadataSchema: [
          {
            key: "vendor",
            label: "Nama Vendor",
            type: "text",
            required: true,
          },
          {
            key: "kategori",
            label: "Kategori",
            type: "select",
            options: ["A", "B"],
            required: false,
          },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const createdPayload = (await createRes.json()) as { data: { id: string } };

    // Get one
    const getRes = await api.request(
      `http://localhost/api/transaction-types/${createdPayload.data.id}`,
    );
    expect(getRes.status).toBe(200);

    // Update
    const updateRes = await api.request(
      `http://localhost/api/transaction-types/${createdPayload.data.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Pengeluaran Khusus Update" }),
      },
    );
    expect(updateRes.status).toBe(200);

    // Delete
    const deleteRes = await api.request(
      `http://localhost/api/transaction-types/${createdPayload.data.id}`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(204);
  });

  it("creates, updates, and deletes transactions while syncing double-entry journals", async () => {
    const { api, client } = setup();

    const typeRes = await api.request("http://localhost/api/transaction-types");
    const types = ((await typeRes.json()) as { data: Array<{ id: string; code: string }> }).data;
    const cashSaleType = types.find((t) => t.code === "TRX-01")!;

    // Create transaction
    const postRes = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-21",
        transactionTypeId: cashSaleType.id,
        amount: "500000",
        memo: "Penjualan resep sore",
        metadata: { shift: "Pagi" },
      }),
    });
    expect(postRes.status).toBe(201);
    const tx = ((await postRes.json()) as { data: { id: string; journalId: string } }).data;
    expect(tx.journalId).toBeDefined();

    // Check generated journal
    const journal = client.db.select().from(journals).where(eq(journals.id, tx.journalId)).get();
    expect(journal).toBeDefined();
    expect(journal?.sourceModule).toBe("TRANSACTION");
    expect(journal?.sourceId).toBe(tx.id);

    const lines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, tx.journalId))
      .all();
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.debit > 0)?.debit).toBe(50000000);
    expect(lines.find((l) => l.credit > 0)?.credit).toBe(50000000);

    // Update transaction amount
    const putRes = await api.request(`http://localhost/api/transactions/${tx.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: "750000",
        memo: "Penjualan resep sore update",
      }),
    });
    expect(putRes.status).toBe(200);

    const updatedLines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, tx.journalId))
      .all();
    expect(updatedLines.find((l) => l.debit > 0)?.debit).toBe(75000000);
    expect(updatedLines.find((l) => l.credit > 0)?.credit).toBe(75000000);

    // Delete transaction
    const delRes = await api.request(`http://localhost/api/transactions/${tx.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(204);

    expect(
      client.db.select().from(journals).where(eq(journals.id, tx.journalId)).all(),
    ).toHaveLength(0);
    expect(
      client.db.select().from(journalLines).where(eq(journalLines.journalId, tx.journalId)).all(),
    ).toHaveLength(0);
  });

  it("calculates sequential running balances and mutations for the 7 cash & bank columns", async () => {
    const { api } = setup();

    const types = (
      (await (await api.request("http://localhost/api/transaction-types")).json()) as {
        data: Array<{ id: string; code: string }>;
      }
    ).data;

    const modalType = types.find((t) => t.code === "TRX-42")!; // Debit 1103 (Bank Jago), Credit 3101 (Modal)
    const tukaranType = types.find((t) => t.code === "TRX-18")!; // Debit 1101 (Tukaran), Credit 1103 (Bank Jago)
    const jualTunaiType = types.find((t) => t.code === "TRX-01")!; // Debit 1102 (Tunai Kasir), Credit 4101 (Omset)
    const bayarListrikType = types.find((t) => t.code === "TRX-34")!; // Debit 6103 (Listrik), Credit 1103 (Bank Jago)

    // Row 1: Setor Modal Rp 10.000.000 ke Bank Jago (1103)
    await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-01",
        transactionTypeId: modalType.id,
        amount: "10000000",
      }),
    });

    // Row 2: Ambil Rp 500.000 dari Bank Jago (1103) ke Uang Tukaran (1101)
    await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-02",
        transactionTypeId: tukaranType.id,
        amount: "500000",
      }),
    });

    // Row 3: Penjualan Tunai Rp 1.500.000 ke Kasir (1102)
    await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-03",
        transactionTypeId: jualTunaiType.id,
        amount: "1500000",
      }),
    });

    // Row 4: Bayar Listrik Rp 300.000 via Bank Jago (1103)
    await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-04",
        transactionTypeId: bayarListrikType.id,
        amount: "300000",
      }),
    });

    // Query list transactions
    const listRes = await api.request("http://localhost/api/transactions");
    expect(listRes.status).toBe(200);
    const rows = (
      (await listRes.json()) as {
        data: Array<{
          amount: number;
          runningBalances: Record<string, number>;
          mutations: Record<string, number>;
        }>;
      }
    ).data;

    expect(rows).toHaveLength(4);

    // Check Row 1: Bank Jago = 10jt (+10jt)
    expect(rows[0]!.runningBalances["1103"]).toBe(10_000_000_00);
    expect(rows[0]!.mutations["1103"]).toBe(10_000_000_00);

    // Check Row 2: Bank Jago = 9.5jt (-500rb), Tukaran = 500rb (+500rb)
    expect(rows[1]!.runningBalances["1103"]).toBe(9_500_000_00);
    expect(rows[1]!.mutations["1103"]).toBe(-500_000_00);
    expect(rows[1]!.runningBalances["1101"]).toBe(500_000_00);
    expect(rows[1]!.mutations["1101"]).toBe(500_000_00);

    // Check Row 3: Tunai Kasir = 1.5jt (+1.5jt)
    expect(rows[2]!.runningBalances["1102"]).toBe(1_500_000_00);
    expect(rows[2]!.mutations["1102"]).toBe(1_500_000_00);

    // Check Row 4: Bank Jago = 9.2jt (-300rb)
    expect(rows[3]!.runningBalances["1103"]).toBe(9_200_000_00);
    expect(rows[3]!.mutations["1103"]).toBe(-300_000_00);

    // Check Summary endpoint
    const summaryRes = await api.request("http://localhost/api/transactions/summary");
    expect(summaryRes.status).toBe(200);
    const summary = (
      (await summaryRes.json()) as {
        data: {
          accounts: Array<{ code: string; balance: number }>;
          totalTransactions: number;
        };
      }
    ).data;

    expect(summary.totalTransactions).toBe(4);
    const jagoAcc = summary.accounts.find((a) => a.code === "1103");
    expect(jagoAcc?.balance).toBe(9_200_000_00);
    const tukaranAcc = summary.accounts.find((a) => a.code === "1101");
    expect(tukaranAcc?.balance).toBe(500_000_00);
    const kasirAcc = summary.accounts.find((a) => a.code === "1102");
    expect(kasirAcc?.balance).toBe(1_500_000_00);
  });

  it("maintains balance sheet equation across seeded sample transactions", () => {
    const { client } = setup();
    seedSampleTransactions(client);

    const balanceSheet = getBalanceSheet(client.db, "2026-08-31");
    expect(balanceSheet.isBalanced).toBe(true);
    expect(balanceSheet.difference).toBe(0);
  });

  it("returns opening balances in transactions summary when 0 transactions exist", async () => {
    const { api, client } = setup();

    // Insert locked opening balances for cash accounts
    client.db
      .insert(openingBalances)
      .values([
        {
          id: "ob-1",
          cutoffDate: "2026-07-31",
          accountId: "coa-1102", // Tunai Kasir
          debitAmount: 7_500_000_00, // 7.5jt
          creditAmount: 0,
          isLocked: true,
        },
        {
          id: "ob-2",
          cutoffDate: "2026-07-31",
          accountId: "coa-1103", // Bank Jago
          debitAmount: 15_000_000_00, // 15jt
          creditAmount: 0,
          isLocked: true,
        },
      ])
      .run();

    // With 0 transactions, summary must reflect opening balances
    const summaryRes = await api.request("http://localhost/api/transactions/summary");
    expect(summaryRes.status).toBe(200);
    const summary = (
      (await summaryRes.json()) as {
        data: {
          accounts: Array<{ code: string; balance: number }>;
          totalTransactions: number;
        };
      }
    ).data;

    expect(summary.totalTransactions).toBe(0);
    expect(summary.accounts.find((a) => a.code === "1102")?.balance).toBe(7_500_000_00);
    expect(summary.accounts.find((a) => a.code === "1103")?.balance).toBe(15_000_000_00);
    expect(summary.accounts.find((a) => a.code === "1101")?.balance).toBe(0);
  });

  it("accepts formatted zero amount and nullish metadata via API", async () => {
    const { api } = setup();
    const typeRes = await api.request("http://localhost/api/transaction-types");
    const types = ((await typeRes.json()) as { data: Array<{ id: string; code: string }> }).data;

    const res = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-20",
        transactionTypeId: types[0]!.id,
        amount: "0,00",
        metadata: null,
      }),
    });

    expect(res.status).toBe(201);
    const data = ((await res.json()) as { data: { amount: number; metadata: any } }).data;
    expect(data.amount).toBe(0);
    expect(data.metadata).toEqual({});
  });

  it("returns inferred transaction group for transaction types and transactions", async () => {
    const { api } = setup();

    const typeRes = await api.request("http://localhost/api/transaction-types");
    const types = (
      (await typeRes.json()) as {
        data: Array<{ id: string; code: string; name: string; group?: string }>;
      }
    ).data;

    // Check specific known types:
    const trx01 = types.find((t) => t.code === "TRX-01"); // Penjualan Tunai Kasir
    expect(trx01?.group).toBe("omzet");

    const trx04 = types.find((t) => t.code === "TRX-04"); // Biaya Admin Shopee
    expect(trx04?.group).toBe("biaya_operasional");

    const trx05 = types.find((t) => t.code === "TRX-05"); // Tarik Saldo Shopee ke Bank Jago
    expect(trx05?.group).toBe("transfer_antar_akun");

    const trx15 = types.find((t) => t.code === "TRX-15"); // Pelunasan Piutang Pelanggan
    expect(trx15?.group).toBe("pelunasan_piutang");

    const trx25 = types.find((t) => t.code === "TRX-25"); // Pembelian Stok Obat Tempo
    expect(trx25?.group).toBe("pembelian_persediaan");

    const trx27 = types.find((t) => t.code === "TRX-27"); // Pelunasan Hutang Dagang PBF
    expect(trx27?.group).toBe("pembayaran_hutang");

    const trx42 = types.find((t) => t.code === "TRX-42"); // Setoran Modal Pemilik
    expect(trx42?.group).toBe("tidak_terkategori");

    // Create a transaction and check that list transactions returns group
    await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-08-20",
        transactionTypeId: trx01!.id,
        amount: "150.000",
      }),
    });

    const txRes = await api.request("http://localhost/api/transactions");
    const txs = (
      (await txRes.json()) as {
        data: Array<{ transactionTypeId: string; group?: string }>;
      }
    ).data;
    expect(txs.length).toBeGreaterThanOrEqual(1);
    expect(txs[0]?.group).toBe("omzet");
  });

  it("handles idempotent transaction creation with X-Idempotency-Key", async () => {
    const { api, client } = setup();

    const typeRes = await api.request("http://localhost/api/transaction-types");
    const types = (
      (await typeRes.json()) as {
        data: Array<{ id: string; code: string }>;
      }
    ).data;
    const trx01 = types.find((t) => t.code === "TRX-01")!;

    // 1. First request with X-Idempotency-Key
    const res1 = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "pos:shift:shift-100:cash",
      },
      body: JSON.stringify({
        transactionDate: "2026-10-17",
        transactionTypeId: trx01.id,
        amount: "250.000",
        memo: "Penjualan Shift 1",
      }),
    });
    expect(res1.status).toBe(201);
    const data1 = ((await res1.json()) as { data: any }).data;
    expect(data1.idempotencyKey).toBe("pos:shift:shift-100:cash");

    const journalCount1 = client.db.select().from(journals).all().length;

    // 2. Second request with same idempotency key
    const res2 = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "pos:shift:shift-100:cash",
      },
      body: JSON.stringify({
        transactionDate: "2026-10-17",
        transactionTypeId: trx01.id,
        amount: "250.000",
        memo: "Penjualan Shift 1",
      }),
    });
    expect(res2.status).toBe(201);
    const data2 = ((await res2.json()) as { data: any }).data;
    expect(data2.id).toBe(data1.id);

    // Verify journal entries were not duplicated
    const journalCount2 = client.db.select().from(journals).all().length;
    expect(journalCount2).toBe(journalCount1);
  });

  it("exposes accounting group and customFields contract in GET /api/transaction-types and validates metadata on POST /api/transactions", async () => {
    const { api } = setup();

    const typeRes = await api.request("http://localhost/api/transaction-types");
    expect(typeRes.status).toBe(200);
    const types = (
      (await typeRes.json()) as {
        data: Array<{
          id: string;
          code: string;
          group: string;
          customFields?: Array<{
            key: string;
            label: string;
            dataType: string;
            required: boolean;
            options?: string[];
          }>;
        }>;
      }
    ).data;

    const trx01 = types.find((t) => t.code === "TRX-01")!;
    expect(trx01.group).toBe("omzet");
    expect(trx01.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "shift", dataType: "string", required: true }),
        expect.objectContaining({ key: "nama_pelanggan", dataType: "string", required: false }),
        expect.objectContaining({ key: "jatuh_tempo", dataType: "date", required: false }),
      ]),
    );

    // TRX-14 in same group (omzet) must have the exact same customFields schema
    const trx14 = types.find((t) => t.code === "TRX-14")!;
    expect(trx14.group).toBe("omzet");
    expect(trx14.customFields).toEqual(trx01.customFields);

    const trx25 = types.find((t) => t.code === "TRX-25")!;
    expect(trx25.group).toBe("pembelian_persediaan");
    expect(trx25.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "nama_supplier", dataType: "string", required: true }),
        expect.objectContaining({ key: "no_faktur", dataType: "string", required: false }),
        expect.objectContaining({ key: "tgl_terima_barang", dataType: "date", required: false }),
        expect.objectContaining({ key: "jatuh_tempo", dataType: "date", required: false }),
      ]),
    );
    // total_order and tanggal_order must be removed
    expect(trx25.customFields?.some((f) => f.key === "total_order")).toBe(false);
    expect(trx25.customFields?.some((f) => f.key === "tanggal_order")).toBe(false);

    // TRX-26 in same group (pembelian_persediaan) must have the exact same schema
    const trx26 = types.find((t) => t.code === "TRX-26")!;
    expect(trx26.group).toBe("pembelian_persediaan");
    expect(trx26.customFields).toEqual(trx25.customFields);

    const trx30 = types.find((t) => t.code === "TRX-30")!;
    expect(trx30.group).toBe("tidak_terkategori");

    const trx31 = types.find((t) => t.code === "TRX-31")!;
    expect(trx31.group).toBe("tidak_terkategori");

    const trx32 = types.find((t) => t.code === "TRX-32")!;
    expect(trx32.group).toBe("pembayaran_hutang");
    expect(trx32.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "nama_supplier", dataType: "string", required: false }),
        expect.objectContaining({ key: "nama_vendor", dataType: "string", required: false }),
        expect.objectContaining({ key: "no_faktur", dataType: "string", required: false }),
        expect.objectContaining({ key: "periode_rekap", dataType: "date", required: false }),
        expect.objectContaining({ key: "total_pelunasan", dataType: "number", required: false }),
      ]),
    );

    // TRX-27 in same group (pembayaran_hutang) must have the exact same schema
    const trx27 = types.find((t) => t.code === "TRX-27")!;
    expect(trx27.group).toBe("pembayaran_hutang");
    expect(trx27.customFields).toEqual(trx32.customFields);

    // Reject missing required metadata (nama_supplier) when required
    const missingRequiredRes = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-10-18",
        transactionTypeId: trx25.id,
        amount: "1500000",
        metadata: {
          no_faktur: "INV-2026-001",
          // missing required nama_supplier
        },
      }),
    });
    expect(missingRequiredRes.status).toBe(400);
    const missingErr = (await missingRequiredRes.json()) as { error: string };
    expect(missingErr.error).toContain("Metadata wajib belum diisi");

    // Accept when optional fields (no_faktur, jatuh_tempo) are omitted
    const optionalOmittedRes = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-10-18",
        transactionTypeId: trx25.id,
        amount: "1500000",
        metadata: {
          nama_supplier: "PT Kimia Farma",
        },
      }),
    });
    expect(optionalOmittedRes.status).toBe(201);

    // Reject invalid date format in metadata
    const invalidDateRes = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-10-18",
        transactionTypeId: trx25.id,
        amount: "1500000",
        metadata: {
          nama_supplier: "PT Kimia Farma",
          no_faktur: "INV-2026-001",
          jatuh_tempo: "bukan-tanggal",
        },
      }),
    });
    expect(invalidDateRes.status).toBe(400);
    const dateErr = (await invalidDateRes.json()) as { error: string };
    expect(dateErr.error).toContain("YYYY-MM-DD");

    // Accept valid metadata payload
    const validRes = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionDate: "2026-10-18",
        transactionTypeId: trx25.id,
        amount: "1500000",
        metadata: {
          nama_supplier: "PT Kimia Farma",
          no_faktur: "INV-2026-001",
          jatuh_tempo: "2026-11-18",
        },
      }),
    });
    expect(validRes.status).toBe(201);
  });
});
