export type TransactionGroup =
  | "omzet"
  | "biaya_operasional"
  | "pelunasan_piutang"
  | "pembayaran_hutang"
  | "pembelian_persediaan"
  | "transfer_antar_akun"
  | "tidak_terkategori";

export type TransactionGroupConfig = {
  key: TransactionGroup;
  label: string;
  badgeLabel: string;
  description: string;
  badgeClass: string;
};

export const TRANSACTION_GROUPS: TransactionGroupConfig[] = [
  {
    key: "omzet",
    label: "Omzet",
    badgeLabel: "Omzet",
    description: "Pendapatan dari penjualan kasir, marketplace, atau klinik",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    key: "biaya_operasional",
    label: "Biaya Operasional",
    badgeLabel: "Biaya Operasional",
    description: "Beban pengeluaran operasional apotek seperti gaji, admin, listrik, dan utilitas",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
  },
  {
    key: "pelunasan_piutang",
    label: "Pelunasan Piutang",
    badgeLabel: "Pelunasan Piutang",
    description: "Penerimaan pembayaran piutang pelanggan atau pencairan dana pending marketplace",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
  },
  {
    key: "pembayaran_hutang",
    label: "Pembayaran Hutang",
    badgeLabel: "Pembayaran Hutang",
    description: "Pelunasan faktur hutang dagang PBF distributor atau hutang konsinyasi",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    key: "pembelian_persediaan",
    label: "Pembelian Persediaan",
    badgeLabel: "Pembelian Persediaan",
    description: "Pembelian stok obat/barang dagang baik secara tempo maupun tunai",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  {
    key: "transfer_antar_akun",
    label: "Transfer Antar Akun",
    badgeLabel: "Transfer Antar Akun",
    description: "Mutasi perpindahan dana antar rekening kas, bank, dan pos saving",
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
  },
  {
    key: "tidak_terkategori",
    label: "Tidak Terkategori",
    badgeLabel: "Tidak Terkategori",
    description: "Transaksi non-operasional atau penyesuaian di luar grup utama di atas",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
];

export const TRANSACTION_GROUP_LABELS: Record<TransactionGroup, string> = {
  omzet: "Omzet",
  biaya_operasional: "Biaya Operasional",
  pelunasan_piutang: "Pelunasan Piutang",
  pembayaran_hutang: "Pembayaran Hutang",
  pembelian_persediaan: "Pembelian Persediaan",
  transfer_antar_akun: "Transfer Antar Akun",
  tidak_terkategori: "Tidak Terkategori",
};

export type AccountLike = {
  code?: string;
  classification?: string;
  name?: string;
  parentId?: string | null;
};

export function isCashBankAccount(acc?: AccountLike | null): boolean {
  if (!acc) return false;
  const code = acc.code || "";
  if (code.startsWith("11")) return true;
  if (acc.parentId === "1100" || acc.parentId === "coa-1100") return true;
  const name = (acc.name || "").toLowerCase();
  return name.includes("kas") || name.includes("bank") || name.includes("saldo");
}

export function isRevenueAccount(acc?: AccountLike | null): boolean {
  if (!acc) return false;
  if (acc.classification === "PENDAPATAN") return true;
  const code = acc.code || "";
  if (code.startsWith("41")) return true;
  const name = (acc.name || "").toLowerCase();
  return name.includes("omset") || name.includes("omzet") || name.includes("penjualan");
}

export function isOperatingExpenseAccount(acc?: AccountLike | null): boolean {
  if (!acc) return false;
  if (acc.classification === "BEBAN_OPERASIONAL") return true;
  const code = acc.code || "";
  if (code.startsWith("61") || code.startsWith("62")) return true;
  const name = (acc.name || "").toLowerCase();
  return name.includes("beban operasional") || name.includes("gaji") || name.includes("admin");
}

export function isInventoryAccount(acc?: AccountLike | null): boolean {
  if (!acc) return false;
  const code = acc.code || "";
  if (code === "1301" || code.startsWith("13")) return true;
  const name = (acc.name || "").toLowerCase();
  return name.includes("persediaan") || name.includes("stok barang");
}

export function isReceivableAccount(acc?: AccountLike | null): boolean {
  if (!acc) return false;
  const code = acc.code || "";
  if (code === "1201" || code === "1203" || code === "1204" || code === "1205") return true;
  const name = (acc.name || "").toLowerCase();
  if (name.includes("piutang") || name.includes("dana pending")) return true;
  if (code.startsWith("12") && !code.startsWith("13") && !code.startsWith("14")) {
    return true;
  }
  return false;
}

export function isPayableAccount(acc?: AccountLike | null): boolean {
  if (!acc) return false;
  if (
    acc.classification === "KEWAJIBAN_LANCAR" ||
    acc.classification === "KEWAJIBAN_JANGKA_PANJANG"
  ) {
    return true;
  }
  const code = acc.code || "";
  if (code.startsWith("21") || code.startsWith("20")) return true;
  const name = (acc.name || "").toLowerCase();
  return name.includes("hutang") || name.includes("kewajiban");
}

/**
 * Infer the business transaction group from debit and credit accounts.
 *
 * Rules:
 * 1. Transfer Antar Akun: Both debit and credit are Cash/Bank (11xx).
 * 2. Omzet: Credit is Revenue/Omset (41xx / PENDAPATAN).
 * 3. Biaya Operasional: Debit is Operating Expense (61xx, 62xx / BEBAN_OPERASIONAL).
 * 4. Pembelian Persediaan: Debit is Inventory/Stock (13xx / Stok Barang).
 * 5. Pelunasan Piutang: Credit is Receivable/Pending (12xx) and Debit is Cash/Bank (11xx).
 * 6. Pembayaran Hutang: Debit is Payable/Liability (21xx) and Credit is Cash/Bank (11xx).
 * 7. Fallback: "tidak_terkategori"
 */
export function inferTransactionGroup(
  debit?: AccountLike | null,
  credit?: AccountLike | null,
): TransactionGroup {
  // 1. Transfer Antar Akun
  if (isCashBankAccount(debit) && isCashBankAccount(credit)) {
    return "transfer_antar_akun";
  }

  // 2. Omzet
  if (isRevenueAccount(credit)) {
    return "omzet";
  }

  // 3. Biaya Operasional
  if (isOperatingExpenseAccount(debit)) {
    return "biaya_operasional";
  }

  // 4. Pembelian Persediaan
  if (isInventoryAccount(debit)) {
    return "pembelian_persediaan";
  }

  // 5. Pelunasan Piutang
  if (isReceivableAccount(credit) && isCashBankAccount(debit)) {
    return "pelunasan_piutang";
  }

  // 6. Pembayaran Hutang
  if (isPayableAccount(debit) && isCashBankAccount(credit)) {
    return "pembayaran_hutang";
  }

  // 7. Fallback
  return "tidak_terkategori";
}

export type PosSyncCategory = "goods_receiving" | "shift_sales" | "consignment_settlement";

const SHIFT_SALES_CODES = new Set([
  "TRX-01",
  "TRX-02",
  "TRX-06",
  "TRX-10",
  "TRX-12",
  "TRX-14",
  "TRX-15",
  "TRX-16",
  "TRX-30",
  "TRX-31",
]);

const GOODS_RECEIVING_CODES = new Set(["TRX-25", "TRX-26", "TRX-27"]);

const CONSIGNMENT_SETTLEMENT_CODES = new Set(["TRX-32"]);

/**
 * Infers the POS synchronization contract category (`goods_receiving`, `shift_sales`,
 * or `consignment_settlement`) for a transaction type.
 */
export function inferPosSyncCategory(params: {
  code?: string;
  name?: string;
  group?: TransactionGroup;
  debit?: AccountLike | null;
  credit?: AccountLike | null;
  metadataSchema?: ReadonlyArray<{ key: string; required?: boolean }>;
}): PosSyncCategory | undefined {
  const code = (params.code || "").trim().toUpperCase();
  if (CONSIGNMENT_SETTLEMENT_CODES.has(code)) return "consignment_settlement";
  if (GOODS_RECEIVING_CODES.has(code)) return "goods_receiving";
  if (SHIFT_SALES_CODES.has(code)) return "shift_sales";

  const nameLower = (params.name || "").toLowerCase();
  const group = params.group ?? inferTransactionGroup(params.debit, params.credit);

  if (
    (params.debit?.code === "2104" && isCashBankAccount(params.credit)) ||
    (group === "pembayaran_hutang" && nameLower.includes("konsinyasi"))
  ) {
    return "consignment_settlement";
  }

  if (group === "pembelian_persediaan" || isInventoryAccount(params.debit)) {
    return "goods_receiving";
  }

  if (
    group === "omzet" ||
    (params.debit?.code === "5102" && params.credit?.code === "2104") ||
    params.metadataSchema?.some((field) => field.key === "shift")
  ) {
    return "shift_sales";
  }

  return undefined;
}
