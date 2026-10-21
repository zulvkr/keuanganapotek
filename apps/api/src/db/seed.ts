import { eq } from "drizzle-orm";
import { createSqliteClient } from "./client.js";
import { runMigrations } from "./migrate.js";
import { accounts, transactionTypes } from "./schema/index.js";
import { createTransaction } from "../services/transaction.service.js";
import { lockOpeningBalance, saveOpeningBalances } from "../services/opening-balance.service.js";
import { seedUsers } from "./seeds/users.seed.js";
import type { MetadataFieldDefinition, TransactionGroup } from "@keuangan-apotek/shared";

type SeedAccount = {
  code: string;
  name: string;
  classification:
    | "ASET_LANCAR"
    | "ASET_TIDAK_LANCAR"
    | "KEWAJIBAN_LANCAR"
    | "KEWAJIBAN_JANGKA_PANJANG"
    | "EKUITAS"
    | "PENDAPATAN"
    | "BEBAN_POKOK"
    | "BEBAN_OPERASIONAL"
    | "BEBAN_NON_OPERASIONAL";
  normalBalance: "DEBIT" | "KREDIT";
  parentCode?: string;
  level: number;
  isGroup: boolean;
};

export const pharmacyAccounts: SeedAccount[] = [
  // --- LEVEL 1: HEADERS ---
  {
    code: "1000",
    name: "ASET",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    level: 1,
    isGroup: true,
  },
  {
    code: "2000",
    name: "KEWAJIBAN",
    classification: "KEWAJIBAN_LANCAR",
    normalBalance: "KREDIT",
    level: 1,
    isGroup: true,
  },
  {
    code: "3000",
    name: "EKUITAS",
    classification: "EKUITAS",
    normalBalance: "KREDIT",
    level: 1,
    isGroup: true,
  },
  {
    code: "4000",
    name: "PENDAPATAN",
    classification: "PENDAPATAN",
    normalBalance: "KREDIT",
    level: 1,
    isGroup: true,
  },
  {
    code: "5000",
    name: "BEBAN POKOK PENJUALAN",
    classification: "BEBAN_POKOK",
    normalBalance: "DEBIT",
    level: 1,
    isGroup: true,
  },
  {
    code: "6000",
    name: "BEBAN OPERASIONAL",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    level: 1,
    isGroup: true,
  },

  // --- LEVEL 2: GROUPS ---
  {
    code: "1100",
    name: "Kas & Bank",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1000",
    level: 2,
    isGroup: true,
  },
  {
    code: "1200",
    name: "Aset Lancar Lainnya",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1000",
    level: 2,
    isGroup: true,
  },
  {
    code: "1600",
    name: "Aset Tetap",
    classification: "ASET_TIDAK_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1000",
    level: 2,
    isGroup: true,
  },
  {
    code: "2100",
    name: "Kewajiban Lancar",
    classification: "KEWAJIBAN_LANCAR",
    normalBalance: "KREDIT",
    parentCode: "2000",
    level: 2,
    isGroup: true,
  },
  {
    code: "3100",
    name: "Modal & Ekuitas",
    classification: "EKUITAS",
    normalBalance: "KREDIT",
    parentCode: "3000",
    level: 2,
    isGroup: true,
  },
  {
    code: "4100",
    name: "Pendapatan Usaha",
    classification: "PENDAPATAN",
    normalBalance: "KREDIT",
    parentCode: "4000",
    level: 2,
    isGroup: true,
  },
  {
    code: "5100",
    name: "Beban Pokok",
    classification: "BEBAN_POKOK",
    normalBalance: "DEBIT",
    parentCode: "5000",
    level: 2,
    isGroup: true,
  },
  {
    code: "6100",
    name: "Beban Operasional Outlet",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6000",
    level: 2,
    isGroup: true,
  },
  {
    code: "6300",
    name: "Beban Non-Operasional",
    classification: "BEBAN_NON_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6000",
    level: 2,
    isGroup: true,
  },

  // --- LEVEL 3: KAS & BANK ---
  {
    code: "1101",
    name: "Uang tukaran kasir permanen",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },
  {
    code: "1102",
    name: "Tunai Kasir",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },
  {
    code: "1103",
    name: "Bank Jago Syariah",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },
  {
    code: "1106",
    name: "Saldo Grab Merchant",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },
  {
    code: "1107",
    name: "Saldo QRIS DANA",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },
  {
    code: "1108",
    name: "Saving Gaji",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },
  {
    code: "1109",
    name: "Saving Sewa",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1100",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: ASET LANCAR LAINNYA ---
  {
    code: "1201",
    name: "Dana Pending + Saldo Shopee",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1200",
    level: 3,
    isGroup: false,
  },
  {
    code: "1203",
    name: "Dana Pending + Saldo Blibli",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1200",
    level: 3,
    isGroup: false,
  },
  {
    code: "1204",
    name: "Kasbon Pelanggan / Pasien",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1200",
    level: 3,
    isGroup: false,
  },
  {
    code: "1205",
    name: "Piutang supplier",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1200",
    level: 3,
    isGroup: false,
  },
  {
    code: "1301",
    name: "Stok Barang",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1200",
    level: 3,
    isGroup: false,
  },
  {
    code: "1401",
    name: "Saldo sewa dibayar dimuka",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1200",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: ASET TETAP ---
  {
    code: "1601",
    name: "Aset tetap, dalam biaya",
    classification: "ASET_TIDAK_LANCAR",
    normalBalance: "DEBIT",
    parentCode: "1600",
    level: 3,
    isGroup: false,
  },
  {
    code: "1699",
    name: "Akumulasi Penyusutan Aset Tetap",
    classification: "ASET_TIDAK_LANCAR",
    normalBalance: "KREDIT",
    parentCode: "1600",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: KEWAJIBAN ---
  {
    code: "2102",
    name: "Hutang Dagang",
    classification: "KEWAJIBAN_LANCAR",
    normalBalance: "KREDIT",
    parentCode: "2100",
    level: 3,
    isGroup: false,
  },
  {
    code: "2104",
    name: "Hutang konsinyasi",
    classification: "KEWAJIBAN_LANCAR",
    normalBalance: "KREDIT",
    parentCode: "2100",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: EKUITAS ---
  {
    code: "3101",
    name: "Akun Modal",
    classification: "EKUITAS",
    normalBalance: "KREDIT",
    parentCode: "3100",
    level: 3,
    isGroup: false,
  },
  {
    code: "3201",
    name: "Laba ditahan",
    classification: "EKUITAS",
    normalBalance: "KREDIT",
    parentCode: "3100",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: PENDAPATAN ---
  {
    code: "4101",
    name: "Omset (mencakup uang fisik dan dana pending)",
    classification: "PENDAPATAN",
    normalBalance: "KREDIT",
    parentCode: "4100",
    level: 3,
    isGroup: false,
  },
  {
    code: "4201",
    name: "Pendapatan lain-lain",
    classification: "PENDAPATAN",
    normalBalance: "KREDIT",
    parentCode: "4100",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: BEBAN POKOK (HPP) ---
  {
    code: "5101",
    name: "HPP",
    classification: "BEBAN_POKOK",
    normalBalance: "DEBIT",
    parentCode: "5100",
    level: 3,
    isGroup: false,
  },
  {
    code: "5102",
    name: "HPP konsinyasi",
    classification: "BEBAN_POKOK",
    normalBalance: "DEBIT",
    parentCode: "5100",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: BEBAN OPERASIONAL ---
  {
    code: "6101",
    name: "Beban admin transaksi",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6102",
    name: "Beban gaji",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6103",
    name: "Beban Listrik, Air, Internet",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6104",
    name: "Beban Perlengkapan Toko",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6105",
    name: "Beban Promosi",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6106",
    name: "Amortisasi sewa bangunan bulanan",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6107",
    name: "Beban lain-lain",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },
  {
    code: "6201",
    name: "Penyusutan Aset Tetap",
    classification: "BEBAN_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6100",
    level: 3,
    isGroup: false,
  },

  // --- LEVEL 3: BEBAN NON-OPERASIONAL ---
  {
    code: "6301",
    name: "Beban Pajak",
    classification: "BEBAN_NON_OPERASIONAL",
    normalBalance: "DEBIT",
    parentCode: "6300",
    level: 3,
    isGroup: false,
  },
];

export function seedAccounts(client: ReturnType<typeof createSqliteClient>): number {
  const ids = new Map(pharmacyAccounts.map((account) => [account.code, `coa-${account.code}`]));
  const validCodes = new Set(pharmacyAccounts.map((a) => a.code));

  client.db.transaction((tx) => {
    // 1. Clean up or deactivate old legacy accounts not in current master list
    const existing = tx.select({ id: accounts.id, code: accounts.code }).from(accounts).all();
    for (const row of existing) {
      if (!validCodes.has(row.code)) {
        try {
          tx.delete(accounts).where(eq(accounts.id, row.id)).run();
        } catch {
          // In case referenced by legacy test records, deactivate it so it won't appear
          tx.update(accounts)
            .set({ isActive: false, parentId: null })
            .where(eq(accounts.id, row.id))
            .run();
        }
      }
    }

    // 2. Insert or update accounts in level order (level 1 first, then 2, then 3)
    const sorted = [...pharmacyAccounts].sort((a, b) => a.level - b.level);
    for (const account of sorted) {
      const parentId = account.parentCode ? (ids.get(account.parentCode) ?? null) : null;
      tx.insert(accounts)
        .values({
          id: ids.get(account.code)!,
          code: account.code,
          name: account.name,
          parentId,
          classification: account.classification,
          normalBalance: account.normalBalance,
          level: account.level,
          isGroup: account.isGroup,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: accounts.code,
          set: {
            name: account.name,
            parentId,
            classification: account.classification,
            normalBalance: account.normalBalance,
            level: account.level,
            isGroup: account.isGroup,
            isActive: true,
          },
        })
        .run();
    }
  });
  return pharmacyAccounts.length;
}

export type SeedTransactionType = {
  code: string;
  name: string;
  group: TransactionGroup;
  debitCode: string;
  creditCode: string;
  description: string;
  metadataSchema?: MetadataFieldDefinition[];
};

export const standardTransactionTypes: SeedTransactionType[] = [
  // --- GRUP OMZET & PENJUALAN ---
  {
    code: "TRX-01",
    name: "Penjualan Tunai Kasir",
    group: "omzet",
    debitCode: "1102",
    creditCode: "4101",
    description: "Penerimaan uang tunai dari kasir apotek atas penjualan obat dan produk",
    metadataSchema: [], // Mewarisi DEFAULT_SALES_METADATA_SCHEMA (shift)
  },
  {
    code: "TRX-02",
    name: "Penjualan Shopee (Dana Pending + Saldo)",
    group: "omzet",
    debitCode: "1201",
    creditCode: "4101",
    description:
      "Penjualan marketplace Shopee selesai diproses, dana masuk ke pos dana pending + saldo Shopee",
    metadataSchema: [], // Mewarisi DEFAULT_SALES_METADATA_SCHEMA (shift)
  },
  {
    code: "TRX-06",
    name: "Penjualan Blibli (Dana Pending + Saldo)",
    group: "omzet",
    debitCode: "1203",
    creditCode: "4101",
    description: "Penjualan pesanan Blibli diproses, dana masuk ke pos dana pending + saldo Blibli",
    metadataSchema: [], // Mewarisi DEFAULT_SALES_METADATA_SCHEMA (shift)
  },
  {
    code: "TRX-10",
    name: "Penjualan Grab Merchant",
    group: "omzet",
    debitCode: "1106",
    creditCode: "4101",
    description: "Omset penjualan obat via GrabMart merchant",
    metadataSchema: [], // Mewarisi DEFAULT_SALES_METADATA_SCHEMA (shift)
  },
  {
    code: "TRX-12",
    name: "Penjualan QRIS DANA",
    group: "omzet",
    debitCode: "1107",
    creditCode: "4101",
    description: "Pembayaran pelanggan di kasir menggunakan QRIS DANA Bisnis",
    metadataSchema: [], // Mewarisi DEFAULT_SALES_METADATA_SCHEMA (shift)
  },
  {
    code: "TRX-14",
    name: "Penjualan Kasbon",
    group: "omzet",
    debitCode: "1204",
    creditCode: "4101",
    description: "Penjualan obat kasbon pelanggan / pasien atau klinik langganan",
    metadataSchema: [], // Mewarisi DEFAULT_SALES_METADATA_SCHEMA seragam grup omzet
  },

  // --- GRUP BIAYA OPERASIONAL ---
  {
    code: "TRX-04",
    name: "Biaya Admin Shopee",
    group: "biaya_operasional",
    debitCode: "6101",
    creditCode: "1201",
    description: "Pemotongan biaya admin / komisi marketplace Shopee",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-08",
    name: "Biaya Admin Blibli",
    group: "biaya_operasional",
    debitCode: "6101",
    creditCode: "1203",
    description: "Pemotongan fee dan admin merchant Blibli",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-23",
    name: "Pembayaran Gaji via Bank Jago",
    group: "biaya_operasional",
    debitCode: "6102",
    creditCode: "1103",
    description: "Transfer gaji apoteker & asisten langsung dari rekening Bank Jago",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-24",
    name: "Pembayaran Gaji dari Saving Gaji",
    group: "biaya_operasional",
    debitCode: "6102",
    creditCode: "1108",
    description: "Pembayaran gaji karyawan langsung dipotong dari pos simpanan gaji",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-34",
    name: "Bayar Listrik, Air & Internet via Bank Jago",
    group: "biaya_operasional",
    debitCode: "6103",
    creditCode: "1103",
    description: "Pembayaran utilitas outlet apotek bulanan",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-35",
    name: "Beli Perlengkapan Toko Tunai Kasir",
    group: "biaya_operasional",
    debitCode: "6104",
    creditCode: "1102",
    description: "Beli plastik klip obat, etiket, kertas struk, dan ATK kasir apotek",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-36",
    name: "Beban Promosi & Brosur via Bank Jago",
    group: "biaya_operasional",
    debitCode: "6105",
    creditCode: "1103",
    description: "Biaya kampanye media sosial, cetak brosur kesehatan apotek",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-38",
    name: "Amortisasi Sewa Bangunan Bulanan",
    group: "biaya_operasional",
    debitCode: "6106",
    creditCode: "1401",
    description: "Pengakuan beban amortisasi sewa bangunan setiap akhir bulan",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-39",
    name: "Beban Lain-lain Tunai Kasir",
    group: "biaya_operasional",
    debitCode: "6107",
    creditCode: "1102",
    description: "Biaya operasional kas kecil mendesak (parkir, kebersihan lingkungan, dll.)",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },
  {
    code: "TRX-40",
    name: "Penyusutan Aset Tetap Bulanan",
    group: "biaya_operasional",
    debitCode: "6201",
    creditCode: "1699",
    description: "Penyusutan peralatan, etalase, rak obat, dan inventaris apotek",
    metadataSchema: [], // Mewarisi DEFAULT_EXPENSE_METADATA_SCHEMA
  },

  // --- GRUP PELUNASAN KASBON ---
  {
    code: "TRX-15",
    name: "Pelunasan Kasbon Tunai",
    group: "pelunasan_piutang",
    debitCode: "1102",
    creditCode: "1204",
    description: "Penerimaan pelunasan kasbon pelanggan secara tunai di kasir",
    metadataSchema: [], // Mewarisi DEFAULT_RECEIVABLE_PAYMENT_METADATA_SCHEMA
  },
  {
    code: "TRX-16",
    name: "Pelunasan Kasbon via Bank Jago",
    group: "pelunasan_piutang",
    debitCode: "1103",
    creditCode: "1204",
    description: "Pelanggan melunasi kasbon via transfer bank",
    metadataSchema: [], // Mewarisi DEFAULT_RECEIVABLE_PAYMENT_METADATA_SCHEMA
  },

  // --- GRUP PEMBELIAN PERSEDIAAN ---
  {
    code: "TRX-25",
    name: "Pembelian Stok Obat Tempo / Hutang Dagang",
    group: "pembelian_persediaan",
    debitCode: "1301",
    creditCode: "2102",
    description: "Penerimaan faktur distributor farmasi (PBF) tempo dengan termin jatuh tempo",
    metadataSchema: [], // Mewarisi DEFAULT_PURCHASE_METADATA_SCHEMA
  },
  {
    code: "TRX-26",
    name: "Pembelian Stok Obat COD / Tunai Bank Jago",
    group: "pembelian_persediaan",
    debitCode: "1301",
    creditCode: "1103",
    description: "Pembelian obat COD atau tunai ke distributor/supplier langsung lunas",
    metadataSchema: [], // Mewarisi DEFAULT_PURCHASE_METADATA_SCHEMA
  },

  // --- GRUP PEMBAYARAN HUTANG ---
  {
    code: "TRX-27",
    name: "Pelunasan Hutang Dagang PBF via Bank Jago",
    group: "pembayaran_hutang",
    debitCode: "2102",
    creditCode: "1103",
    description: "Pembayaran faktur jatuh tempo ke distributor PBF",
    metadataSchema: [], // Mewarisi DEFAULT_DEBT_PAYMENT_METADATA_SCHEMA
  },
  {
    code: "TRX-32",
    name: "Pelunasan Hutang Konsinyasi via Bank Jago",
    group: "pembayaran_hutang",
    debitCode: "2104",
    creditCode: "1103",
    description: "Penyelesaian bagi hasil titip jual ke pemilik produk konsinyasi",
    metadataSchema: [], // Mewarisi DEFAULT_DEBT_PAYMENT_METADATA_SCHEMA seragam grup pembayaran hutang
  },

  // --- GRUP TRANSFER ANTAR AKUN ---
  {
    code: "TRX-05",
    name: "Tarik Saldo Shopee ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1201",
    description: "Penarikan dana Shopee (dana pending + saldo) ke rekening Bank Jago",
    metadataSchema: [],
  },
  {
    code: "TRX-09",
    name: "Tarik Saldo Blibli ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1203",
    description: "Pencairan dana merchant Blibli (dana pending + saldo) masuk rekening Bank Jago",
    metadataSchema: [],
  },
  {
    code: "TRX-11",
    name: "Pencairan Grab ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1106",
    description: "Transfer settlement otomatis dari Grab ke Bank Jago",
    metadataSchema: [],
  },
  {
    code: "TRX-13",
    name: "Pencairan QRIS DANA ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1107",
    description: "Penarikan saldo merchant QRIS DANA ke Bank Jago",
    metadataSchema: [],
  },
  {
    code: "TRX-17",
    name: "Setoran Tunai Kasir ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1102",
    description: "Setor uang fisik dari laci kasir ke rekening Bank Jago",
    metadataSchema: [],
  },
  {
    code: "TRX-18",
    name: "Penyediaan Uang Tukaran Kasir",
    group: "transfer_antar_akun",
    debitCode: "1101",
    creditCode: "1103",
    description: "Pengisian modal uang tukaran / pecahan kecil untuk kasir kas fisik permanen",
    metadataSchema: [],
  },
  {
    code: "TRX-19",
    name: "Alokasi Saving Gaji dari Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1108",
    creditCode: "1103",
    description: "Penyisihan pos dana khusus gaji karyawan di Bank Jago",
    metadataSchema: [],
  },
  {
    code: "TRX-20",
    name: "Alokasi Saving Sewa dari Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1109",
    creditCode: "1103",
    description: "Penyisihan pos dana simpanan sewa tempat/ruko",
    metadataSchema: [],
  },
  {
    code: "TRX-21",
    name: "Pencairan Saving Gaji ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1108",
    description: "Pengembalian pos simpanan gaji ke rekening operasional utama",
    metadataSchema: [],
  },
  {
    code: "TRX-22",
    name: "Pencairan Saving Sewa ke Bank Jago",
    group: "transfer_antar_akun",
    debitCode: "1103",
    creditCode: "1109",
    description: "Pengembalian pos simpanan sewa ke rekening operasional utama",
    metadataSchema: [],
  },

  // --- GRUP TIDAK TERKATEGORI / LAIN-LAIN ---
  {
    code: "TRX-28",
    name: "Uang Muka / Piutang Supplier",
    group: "tidak_terkategori",
    debitCode: "1205",
    creditCode: "1103",
    description: "Kelebihan bayar atau uang muka pesanan khusus/indent ke supplier",
    metadataSchema: [
      { key: "nama_supplier", label: "Nama Supplier", type: "text", required: true },
      { key: "keterangan_order", label: "Keterangan Pesanan", type: "text", required: false },
    ],
  },
  {
    code: "TRX-29",
    name: "Pengembalian Uang Muka dari Supplier",
    group: "tidak_terkategori",
    debitCode: "1103",
    creditCode: "1205",
    description: "Pengembalian dana retur / order batal dari supplier ke Bank Jago",
    metadataSchema: [
      { key: "nama_supplier", label: "Nama Supplier", type: "text", required: true },
    ],
  },
  {
    code: "TRX-30",
    name: "Penjualan Barang Konsinyasi Tunai",
    group: "tidak_terkategori",
    debitCode: "1102",
    creditCode: "2104",
    description: "Penjualan produk titipan konsinyasi di apotek tunai kasir",
    metadataSchema: [
      {
        key: "shift",
        label: "Shift",
        type: "select",
        options: ["Pagi", "Siang", "Malam"],
        required: true,
      },
      { key: "nama_vendor", label: "Nama Vendor Konsinyasi", type: "text", required: true },
      { key: "nama_produk", label: "Nama Produk", type: "text", required: false },
      { key: "qty", label: "Jumlah Unit Terjual", type: "number", required: false },
    ],
  },
  {
    code: "TRX-31",
    name: "Pengakuan HPP Konsinyasi",
    group: "tidak_terkategori",
    debitCode: "5102",
    creditCode: "2104",
    description: "Pencatatan beban pokok penjualan barang konsinyasi saat terjual di shift kasir",
    metadataSchema: [
      {
        key: "shift",
        label: "Shift",
        type: "select",
        options: ["Pagi", "Siang", "Malam"],
        required: true,
      },
      { key: "nama_kasir", label: "Nama Kasir", type: "text", required: false },
    ],
  },
  {
    code: "TRX-33",
    name: "Pengakuan HPP Stok Obat Terjual",
    group: "tidak_terkategori",
    debitCode: "5101",
    creditCode: "1301",
    description: "Jurnal penyesuaian beban pokok obat atas stok barang yang keluar",
    metadataSchema: [
      { key: "periode_hpp", label: "Periode / Tanggal Rekap", type: "text", required: false },
      { key: "catatan", label: "Catatan Perhitungan", type: "textarea", required: false },
    ],
  },
  {
    code: "TRX-37",
    name: "Pembayaran Sewa Tempat dari Saving Sewa",
    group: "tidak_terkategori",
    debitCode: "1401",
    creditCode: "1109",
    description: "Pembayaran sewa ruko tahunan dibayar dimuka dari pos simpanan sewa",
    metadataSchema: [
      { key: "pemilik_ruko", label: "Pemilik Ruko / Gedung", type: "text", required: false },
      { key: "periode_sewa", label: "Periode Kontrak Sewa", type: "text", required: false },
    ],
  },
  {
    code: "TRX-41",
    name: "Pembayaran Pajak via Bank Jago",
    group: "tidak_terkategori",
    debitCode: "6301",
    creditCode: "1103",
    description: "Penyetoran pajak UMKM PPh Final atau PPh pasal 21",
    metadataSchema: [
      {
        key: "deskripsi",
        label: "Deskripsi",
        type: "text",
        required: true,
        defaultValue: "Pajak UMKM Apotek",
      },
      { key: "jumlah", label: "Jumlah", type: "number", required: false },
      {
        key: "satuan",
        label: "Satuan",
        type: "text",
        required: false,
        placeholder: "masa / bulan",
      },
      {
        key: "jenis_pajak",
        label: "Jenis Pajak",
        type: "select",
        options: ["PPh Final UMKM 0.5%", "PPh 21", "PPN"],
        required: false,
      },
      { key: "ntpn", label: "NTPN / Kode Billing", type: "text", required: false },
    ],
  },
  {
    code: "TRX-42",
    name: "Setoran Modal Pemilik ke Bank Jago",
    group: "tidak_terkategori",
    debitCode: "1103",
    creditCode: "3101",
    description: "Setoran modal tunai pendiri apotek ke rekening operasional",
    metadataSchema: [{ key: "nama_pemilik", label: "Nama Pemilik", type: "text", required: false }],
  },
  {
    code: "TRX-43",
    name: "Pendapatan Lain-lain via Bank Jago",
    group: "tidak_terkategori",
    debitCode: "1103",
    creditCode: "4201",
    description: "Pendapatan non-operasional lainnya (bunga bagi hasil, jasa titip khusus, dll.)",
    metadataSchema: [{ key: "sumber", label: "Sumber Pendapatan", type: "text", required: false }],
  },
];

export function seedTransactionTypes(client: ReturnType<typeof createSqliteClient>): number {
  const validCodes = new Set(standardTransactionTypes.map((t) => t.code));
  client.db.transaction((tx) => {
    // 1. Clean up or deactivate old legacy transaction types
    const existing = tx
      .select({ id: transactionTypes.id, code: transactionTypes.code })
      .from(transactionTypes)
      .all();
    for (const row of existing) {
      if (!validCodes.has(row.code)) {
        try {
          tx.delete(transactionTypes).where(eq(transactionTypes.id, row.id)).run();
        } catch {
          tx.update(transactionTypes)
            .set({ isActive: false })
            .where(eq(transactionTypes.id, row.id))
            .run();
        }
      }
    }

    // 2. Insert or update standard transaction types
    for (const type of standardTransactionTypes) {
      const debitAccountId = `coa-${type.debitCode}`;
      const creditAccountId = `coa-${type.creditCode}`;
      const id = `type-${type.code.toLowerCase()}`;

      tx.insert(transactionTypes)
        .values({
          id,
          code: type.code,
          name: type.name,
          group: type.group || "tidak_terkategori",
          debitAccountId,
          creditAccountId,
          description: type.description,
          metadataSchema: JSON.stringify(type.metadataSchema || []),
          isActive: true,
        })
        .onConflictDoUpdate({
          target: transactionTypes.code,
          set: {
            name: type.name,
            group: type.group || "tidak_terkategori",
            debitAccountId,
            creditAccountId,
            description: type.description,
            metadataSchema: JSON.stringify(type.metadataSchema || []),
            isActive: true,
          },
        })
        .run();
    }
  });
  return standardTransactionTypes.length;
}

export function seedSampleTransactions(client: ReturnType<typeof createSqliteClient>): number {
  const types = client.db.select().from(transactionTypes).all();
  const typeByCode = new Map(types.map((type) => [type.code, type]));

  const sampleRows: Array<{
    date: string;
    typeCode: string;
    amount: number;
    memo?: string;
    metadata?: Record<string, any>;
  }> = [
    // 2026-07-31
    {
      date: "2026-07-31",
      typeCode: "TRX-42", // Setor modal
      amount: 50000000,
      memo: "Setoran modal awal apotek",
      metadata: { nama_pemilik: "Owner Apotek" },
    },
    {
      date: "2026-07-31",
      typeCode: "TRX-18", // Penyediaan uang tukaran
      amount: 500000,
      memo: "Modal uang tukaran kasir",
      metadata: { penanggung_jawab: "Kasir 1" },
    },
    {
      date: "2026-07-31",
      typeCode: "TRX-20", // Alokasi saving sewa
      amount: 12000000,
      memo: "Alokasi simpanan sewa ruko tahun 2026",
      metadata: { alokasi_tahun: "2026" },
    },
    {
      date: "2026-07-31",
      typeCode: "TRX-25", // Pembelian stok tempo
      amount: 25000000,
      memo: "Stok awal obat distributor Kimia Farma",
      metadata: {
        nama_supplier: "PT Kimia Farma",
        no_faktur: "KF-2026-001",
        tgl_terima_barang: "2026-07-31",
        jatuh_tempo: "2026-08-31",
      },
    },
    // 2026-08-20
    {
      date: "2026-08-20",
      typeCode: "TRX-01", // Penjualan tunai kasir
      amount: 2450000,
      memo: "Penjualan tunai shift pagi",
      metadata: { shift: "Pagi", nama_kasir: "Dewi" },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-02", // Penjualan Shopee pending
      amount: 1200000,
      memo: "Penjualan Shopee etikal & suplemen",
      metadata: { shift: "Pagi" },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-12", // Penjualan QRIS DANA
      amount: 850000,
      memo: "Penerimaan QRIS kasir siang",
      metadata: { shift: "Siang" },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-25", // Beli stok obat tempo
      amount: 3500000,
      memo: "Faktur pembelian obat bebas PBF Mensa",
      metadata: {
        nama_supplier: "PT Mensa Binasukses",
        no_faktur: "MB-88910",
        tgl_terima_barang: "2026-08-20",
        jatuh_tempo: "2026-09-20",
      },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-33", // Pengakuan HPP
      amount: 2100000,
      memo: "Pengakuan HPP harian 20 Agustus 2026",
      metadata: { periode_hpp: "2026-08-20" },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-34", // Bayar listrik
      amount: 450000,
      memo: "Listrik PLN outlet Agustus",
      metadata: {
        deskripsi: "Listrik PLN outlet Agustus",
        jumlah: 1,
        satuan: "bulan",
        jenis_utilitas: "Listrik PLN",
        id_pelanggan: "531234567890",
      },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-35", // Beli perlengkapan tunai
      amount: 125000,
      memo: "Kertas kasir & plastik klip obat",
      metadata: {
        deskripsi: "3 roll kertas kasir, 2 pack plastik klip",
        jumlah: 5,
        satuan: "pack",
        nama_toko: "Toko ATK Berkah",
      },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-17", // Setor kasir ke bank
      amount: 1500000,
      memo: "Setoran tunai kasir ke Bank Jago",
      metadata: { disetor_oleh: "Dewi", shift: "Pagi" },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-19", // Alokasi saving gaji
      amount: 1000000,
      memo: "Simpanan gaji mingguan ke pos saving",
      metadata: { alokasi_bulan: "Agustus 2026" },
    },
    {
      date: "2026-08-20",
      typeCode: "TRX-01", // Baris draft nominal 0
      amount: 0,
      memo: "Draft transaksi kosong (nominal Rp 0)",
      metadata: {},
    },
  ];

  let seededCount = 0;
  for (const item of sampleRows) {
    const type = typeByCode.get(item.typeCode);
    if (!type) continue;
    createTransaction(client.db, {
      transactionDate: item.date,
      transactionTypeId: type.id,
      amount: item.amount,
      memo: item.memo,
      metadata: item.metadata,
    });
    seededCount++;
  }

  return seededCount;
}

export const openingBalanceLinesJuly2026 = [
  // Akun Kas & Bank (Total: Rp 40.689.600)
  { accountCode: "1101", debit: "300000", credit: "0", notes: "Uang tukaran kasir permanen" },
  { accountCode: "1102", debit: "290600", credit: "0", notes: "Tunai Kasir" },
  { accountCode: "1103", debit: "11474100", credit: "0", notes: "Bank Jago Syariah" },
  { accountCode: "1106", debit: "0", credit: "0", notes: "Saldo Grab Merchant" },
  { accountCode: "1107", debit: "927400", credit: "0", notes: "Saldo QRIS DANA" },
  { accountCode: "1108", debit: "7797500", credit: "0", notes: "Saving Gaji" },
  { accountCode: "1109", debit: "19900000", credit: "0", notes: "Saving Sewa" },

  // Aset Lancar
  { accountCode: "1201", debit: "1788173", credit: "0", notes: "Dana Pending + Saldo Shopee" },
  { accountCode: "1203", debit: "241554", credit: "0", notes: "Dana Pending + Saldo Blibli" },
  { accountCode: "1204", debit: "0", credit: "0", notes: "Piutang Pelanggan" },
  { accountCode: "1205", debit: "0", credit: "0", notes: "Piutang Supplier" },
  { accountCode: "1301", debit: "46962424", credit: "0", notes: "Stok Barang" },
  { accountCode: "1401", debit: "6333333", credit: "0", notes: "Saldo sewa dibayar dimuka" },

  // Aset Tetap
  { accountCode: "1601", debit: "55635439", credit: "0", notes: "Aset tetap, dalam biaya" },
  { accountCode: "1699", debit: "0", credit: "6787329", notes: "Akumulasi Penyusutan Aset Tetap" },

  // Kewajiban
  { accountCode: "2102", debit: "0", credit: "0", notes: "Hutang dagang" },
  { accountCode: "2104", debit: "0", credit: "0", notes: "Hutang konsinyasi" },

  // Ekuitas
  { accountCode: "3101", debit: "0", credit: "172880000", notes: "Akun Modal" },
  {
    accountCode: "3201",
    debit: "28016806",
    credit: "0",
    notes: "Laba ditahan (defisit penyeimbang per 2026-07-01)",
  },
];

export async function seedOpeningBalances(
  client: ReturnType<typeof createSqliteClient>,
): Promise<string> {
  const cutoffDate = "2026-07-01";
  const lines = openingBalanceLinesJuly2026.map((row) => ({
    accountId: `coa-${row.accountCode}`,
    debitAmount: row.debit,
    creditAmount: row.credit,
    notes: row.notes,
  }));

  await saveOpeningBalances(client.db, { cutoffDate, lines });
  const locked = await lockOpeningBalance(client.db, cutoffDate);
  return locked.journalNo;
}

export { seedUsers };

const invokedFile = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (invokedFile.endsWith("/db/seed.ts") || invokedFile.endsWith("/db/seed.js")) {
  const client = createSqliteClient();
  runMigrations(client.sqlite);
  const usersSeeded = seedUsers(client);
  const accountCount = seedAccounts(client);
  const journalNo = await seedOpeningBalances(client);
  const typeCount = seedTransactionTypes(client);
  const txCount = seedSampleTransactions(client);
  console.log(
    `Seeded users (${usersSeeded.admin.username}, ${usersSeeded.asisten.username}), ${accountCount} accounts, opening balances per 2026-07-01 (${journalNo}), ${typeCount} transaction types, and ${txCount} transactions.`,
  );
  client.sqlite.close();
}
