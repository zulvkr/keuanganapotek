import { createSqliteClient } from "./client.js";
import { runMigrations } from "./migrate.js";
import { accounts } from "./schema/index.js";

type SeedAccount = {
  code: string;
  name: string;
  classification: string;
  normalBalance: "DEBIT" | "KREDIT";
  parentCode?: string;
  level: number;
};

type SeedTuple = [string, string, string, "DEBIT" | "KREDIT", string | undefined, number];

const seedRows: SeedTuple[] = [
  ["1000", "ASET", "ASET_LANCAR", "DEBIT", undefined, 1],
  ["1100", "Kas & Setara Kas", "ASET_LANCAR", "DEBIT", "1000", 2],
  ["1101", "Kas Toko / Kasir", "ASET_LANCAR", "DEBIT", "1100", 3],
  ["1102", "Kas Kecil (Petty Cash)", "ASET_LANCAR", "DEBIT", "1100", 3],
  ["1111", "Bank BCA Operasional", "ASET_LANCAR", "DEBIT", "1100", 3],
  ["1112", "Bank Mandiri Operasional", "ASET_LANCAR", "DEBIT", "1100", 3],
  ["1120", "Kliring QRIS & EDC", "ASET_LANCAR", "DEBIT", "1100", 3],
  ["1200", "Piutang Usaha", "ASET_LANCAR", "DEBIT", "1000", 2],
  ["1300", "Persediaan Barang Dagang", "ASET_LANCAR", "DEBIT", "1000", 2],
  ["1301", "Persediaan Obat Resep (Etikal)", "ASET_LANCAR", "DEBIT", "1300", 3],
  ["1302", "Persediaan Obat Bebas (OTC) & Herbal", "ASET_LANCAR", "DEBIT", "1300", 3],
  ["1303", "Persediaan Alat Kesehatan", "ASET_LANCAR", "DEBIT", "1300", 3],
  ["1400", "Pajak Dibayar Dimuka (PPN Masukan)", "ASET_LANCAR", "DEBIT", "1000", 2],
  ["1600", "Aset Tetap", "ASET_TIDAK_LANCAR", "DEBIT", "1000", 2],
  ["1601", "Peralatan & Rak Apotek", "ASET_TIDAK_LANCAR", "DEBIT", "1600", 3],
  ["1602", "Kendaraan Operasional", "ASET_TIDAK_LANCAR", "DEBIT", "1600", 3],
  ["1699", "Akumulasi Penyusutan Aset Tetap", "ASET_TIDAK_LANCAR", "KREDIT", "1600", 3],
  ["2000", "KEWAJIBAN / UTANG", "KEWAJIBAN_LANCAR", "KREDIT", undefined, 1],
  ["2100", "Utang Usaha PBF", "KEWAJIBAN_LANCAR", "KREDIT", "2000", 2],
  ["2110", "Utang Konsinyasi", "KEWAJIBAN_LANCAR", "KREDIT", "2000", 2],
  ["2200", "Beban Akrual / Masih Harus Dibayar", "KEWAJIBAN_LANCAR", "KREDIT", "2000", 2],
  ["2300", "Utang Pajak (PPN Keluaran / PPh 21)", "KEWAJIBAN_LANCAR", "KREDIT", "2000", 2],
  ["3000", "EKUITAS / MODAL", "EKUITAS", "KREDIT", undefined, 1],
  ["3100", "Modal Disetor / Modal Pemilik", "EKUITAS", "KREDIT", "3000", 2],
  ["3101", "Ekuitas Saldo Awal", "EKUITAS", "KREDIT", "3000", 2],
  ["3200", "Saldo Laba Ditahan", "EKUITAS", "KREDIT", "3000", 2],
  ["3300", "Prive / Penarikan Pemilik", "EKUITAS", "DEBIT", "3000", 2],
  ["4000", "PENDAPATAN", "PENDAPATAN", "KREDIT", undefined, 1],
  ["4101", "Pendapatan Penjualan Obat Bebas (OTC)", "PENDAPATAN", "KREDIT", "4000", 2],
  ["4102", "Pendapatan Penjualan Obat Resep", "PENDAPATAN", "KREDIT", "4000", 2],
  ["4103", "Pendapatan Jasa Embalase & Tuslah", "PENDAPATAN", "KREDIT", "4000", 2],
  ["4200", "Pendapatan Konsinyasi (Margin Bagi Hasil)", "PENDAPATAN", "KREDIT", "4000", 2],
  ["4900", "Pendapatan Lain-lain (Selisih Kasir Plus)", "PENDAPATAN", "KREDIT", "4000", 2],
  ["5000", "BEBAN POKOK PENJUALAN (HPP)", "BEBAN_POKOK", "DEBIT", undefined, 1],
  ["5101", "HPP Obat Resep", "BEBAN_POKOK", "DEBIT", "5000", 2],
  ["5102", "HPP Obat Bebas & Alkes", "BEBAN_POKOK", "DEBIT", "5000", 2],
  ["5200", "Potongan Pembelian / Diskon PBF", "BEBAN_POKOK", "KREDIT", "5000", 2],
  ["6000", "BEBAN OPERASIONAL & UMUM", "BEBAN_OPERASIONAL", "DEBIT", undefined, 1],
  ["6101", "Beban Gaji Apoteker & Asisten", "BEBAN_OPERASIONAL", "DEBIT", "6000", 2],
  ["6102", "Beban Listrik, Air, Internet & Telepon", "BEBAN_OPERASIONAL", "DEBIT", "6000", 2],
  ["6103", "Beban Sewa Ruko / Bangunan Apotek", "BEBAN_OPERASIONAL", "DEBIT", "6000", 2],
  ["6104", "Beban Plastik, Klip Obat & Perlengkapan", "BEBAN_OPERASIONAL", "DEBIT", "6000", 2],
  ["6105", "Beban Pembuangan / Kerusakan Obat Kadaluarsa", "BEBAN_OPERASIONAL", "DEBIT", "6000", 2],
  ["6106", "Beban Selisih Kasir Minus", "BEBAN_OPERASIONAL", "DEBIT", "6000", 2],
  ["6201", "Beban Administrasi Bank & EDC Merchant", "BEBAN_NON_OPERASIONAL", "DEBIT", "6000", 2],
];

export const pharmacyAccounts: SeedAccount[] = seedRows.map(([code, name, classification, normalBalance, parentCode, level]) => ({ code, name, classification, normalBalance, parentCode, level }));

export function seedAccounts(client: ReturnType<typeof createSqliteClient>): number {
  const ids = new Map(pharmacyAccounts.map((account) => [account.code, `coa-${account.code}`]));
  client.db.transaction((tx) => {
    for (const account of pharmacyAccounts) {
      tx.insert(accounts).values({
        id: ids.get(account.code)!, code: account.code, name: account.name,
        parentId: account.parentCode ? ids.get(account.parentCode)! : null,
        classification: account.classification, normalBalance: account.normalBalance,
        level: account.level, isActive: true,
      }).onConflictDoUpdate({
        target: accounts.code,
        set: { name: account.name, parentId: account.parentCode ? ids.get(account.parentCode)! : null,
          classification: account.classification, normalBalance: account.normalBalance, level: account.level, isActive: true },
      }).run();
    }
  });
  return pharmacyAccounts.length;
}

const invokedFile = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (invokedFile.endsWith("/db/seed.ts") || invokedFile.endsWith("/db/seed.js")) {
  const client = createSqliteClient();
  runMigrations(client.sqlite);
  console.log(`Seeded ${seedAccounts(client)} pharmacy accounts.`);
  client.sqlite.close();
}
