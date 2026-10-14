import { describe, expect, it } from "vitest";
import {
  inferTransactionGroup,
  TRANSACTION_GROUPS,
  TRANSACTION_GROUP_LABELS,
  type TransactionGroup,
} from "../types/transaction-group.js";

describe("inferTransactionGroup", () => {
  it("has 7 defined transaction groups including fallback", () => {
    expect(TRANSACTION_GROUPS).toHaveLength(7);
    const keys = TRANSACTION_GROUPS.map((g) => g.key);
    expect(keys).toEqual([
      "omzet",
      "biaya_operasional",
      "pelunasan_piutang",
      "pembayaran_hutang",
      "pembelian_persediaan",
      "transfer_antar_akun",
      "tidak_terkategori",
    ]);
  });

  it("infers 'transfer_antar_akun' when both debit and credit are Cash & Bank accounts", () => {
    // TRX-05: Bank Jago (1103) <- Saldo Shopee (1104)
    expect(
      inferTransactionGroup(
        { code: "1103", name: "Bank Jago Syariah", classification: "ASET_LANCAR" },
        { code: "1104", name: "Saldo Penjual Shopee", classification: "ASET_LANCAR" },
      ),
    ).toBe("transfer_antar_akun");

    // TRX-17: Bank Jago (1103) <- Kasir (1102)
    expect(
      inferTransactionGroup(
        { code: "1103", name: "Bank Jago Syariah" },
        { code: "1102", name: "Tunai Kasir" },
      ),
    ).toBe("transfer_antar_akun");

    // TRX-19: Saving Gaji (1108) <- Bank Jago (1103)
    expect(
      inferTransactionGroup(
        { code: "1108", name: "Saving Gaji" },
        { code: "1103", name: "Bank Jago Syariah" },
      ),
    ).toBe("transfer_antar_akun");
  });

  it("infers 'omzet' when credit is Revenue / Omzet", () => {
    // TRX-01: Tunai Kasir (1102) vs Omset (4101)
    expect(
      inferTransactionGroup(
        { code: "1102", name: "Tunai Kasir" },
        { code: "4101", name: "Omset Penjualan", classification: "PENDAPATAN" },
      ),
    ).toBe("omzet");

    // TRX-02: Dana Pending Shopee (1201) vs Omset (4101)
    expect(
      inferTransactionGroup(
        { code: "1201", name: "Dana Pending Shopee" },
        { code: "4101", name: "Omset Penjualan", classification: "PENDAPATAN" },
      ),
    ).toBe("omzet");

    // TRX-14: Piutang Pelanggan (1204) vs Omset (4101)
    expect(
      inferTransactionGroup(
        { code: "1204", name: "Piutang Pelanggan" },
        { code: "4101", name: "Omset", classification: "PENDAPATAN" },
      ),
    ).toBe("omzet");
  });

  it("infers 'biaya_operasional' when debit is Operating Expense", () => {
    // TRX-04: Biaya Admin Shopee (6101) vs Saldo Shopee (1104)
    expect(
      inferTransactionGroup(
        { code: "6101", name: "Beban Admin", classification: "BEBAN_OPERASIONAL" },
        { code: "1104", name: "Saldo Shopee" },
      ),
    ).toBe("biaya_operasional");

    // TRX-23: Gaji Karyawan (6102) vs Bank Jago (1103)
    expect(
      inferTransactionGroup(
        { code: "6102", name: "Beban Gaji", classification: "BEBAN_OPERASIONAL" },
        { code: "1103", name: "Bank Jago" },
      ),
    ).toBe("biaya_operasional");

    // TRX-34: Listrik/Air/Internet (6103) vs Bank Jago (1103)
    expect(
      inferTransactionGroup(
        { code: "6103", name: "Beban Listrik, Air, Internet", classification: "BEBAN_OPERASIONAL" },
        { code: "1103", name: "Bank Jago" },
      ),
    ).toBe("biaya_operasional");
  });

  it("infers 'pembelian_persediaan' when debit is Inventory / Stok Barang", () => {
    // TRX-25: Stok Barang (1301) vs Hutang Dagang (2102) [tempo]
    expect(
      inferTransactionGroup(
        { code: "1301", name: "Stok Barang" },
        { code: "2102", name: "Hutang Dagang", classification: "KEWAJIBAN_LANCAR" },
      ),
    ).toBe("pembelian_persediaan");

    // TRX-26: Stok Barang (1301) vs Bank Jago (1103) [tunai]
    expect(
      inferTransactionGroup(
        { code: "1301", name: "Stok Barang" },
        { code: "1103", name: "Bank Jago Syariah" },
      ),
    ).toBe("pembelian_persediaan");
  });

  it("infers 'pelunasan_piutang' when credit is Receivable / Pending and debit is Cash & Bank", () => {
    // TRX-03: Saldo Shopee (1104) vs Dana Pending Shopee (1201)
    expect(
      inferTransactionGroup(
        { code: "1104", name: "Saldo Shopee" },
        { code: "1201", name: "Dana Pending Shopee" },
      ),
    ).toBe("pelunasan_piutang");

    // TRX-15: Tunai Kasir (1102) vs Piutang Pelanggan (1204)
    expect(
      inferTransactionGroup(
        { code: "1102", name: "Tunai Kasir" },
        { code: "1204", name: "Piutang Pelanggan" },
      ),
    ).toBe("pelunasan_piutang");

    // TRX-16: Bank Jago (1103) vs Piutang Pelanggan (1204)
    expect(
      inferTransactionGroup(
        { code: "1103", name: "Bank Jago" },
        { code: "1204", name: "Piutang Pelanggan" },
      ),
    ).toBe("pelunasan_piutang");
  });

  it("infers 'pembayaran_hutang' when debit is Payable and credit is Cash & Bank", () => {
    // TRX-27: Hutang Dagang (2102) vs Bank Jago (1103)
    expect(
      inferTransactionGroup(
        { code: "2102", name: "Hutang Dagang", classification: "KEWAJIBAN_LANCAR" },
        { code: "1103", name: "Bank Jago Syariah" },
      ),
    ).toBe("pembayaran_hutang");

    // TRX-32: Hutang Konsinyasi (2104) vs Bank Jago (1103)
    expect(
      inferTransactionGroup(
        { code: "2104", name: "Hutang Konsinyasi", classification: "KEWAJIBAN_LANCAR" },
        { code: "1103", name: "Bank Jago" },
      ),
    ).toBe("pembayaran_hutang");
  });

  it("infers 'tidak_terkategori' for other transactions", () => {
    // TRX-42: Setoran Modal Pemilik: Bank Jago (1103) vs Modal (3101)
    expect(
      inferTransactionGroup(
        { code: "1103", name: "Bank Jago" },
        { code: "3101", name: "Akun Modal", classification: "EKUITAS" },
      ),
    ).toBe("tidak_terkategori");

    // TRX-41: Pembayaran Pajak: Beban Pajak (6301) vs Bank Jago (1103)
    expect(
      inferTransactionGroup(
        { code: "6301", name: "Beban Pajak", classification: "BEBAN_NON_OPERASIONAL" },
        { code: "1103", name: "Bank Jago" },
      ),
    ).toBe("tidak_terkategori");

    // Empty or unknown
    expect(inferTransactionGroup(null, null)).toBe("tidak_terkategori");
  });

  it("matches all labels correctly in TRANSACTION_GROUP_LABELS", () => {
    const expectedKeys: TransactionGroup[] = [
      "omzet",
      "biaya_operasional",
      "pelunasan_piutang",
      "pembayaran_hutang",
      "pembelian_persediaan",
      "transfer_antar_akun",
      "tidak_terkategori",
    ];
    for (const key of expectedKeys) {
      expect(TRANSACTION_GROUP_LABELS[key]).toBeDefined();
    }
  });
});
