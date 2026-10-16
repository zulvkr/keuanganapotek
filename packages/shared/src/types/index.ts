export type SourceModule = "GENERAL" | "OPENING_BALANCE" | "TRANSACTION";

export type MetadataFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "multi-select"
  | "boolean";

export type MetadataFieldDefinition = {
  key: string;
  label: string;
  type: MetadataFieldType;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
  helpText?: string;
};

export * from "./transaction-group.js";
import type { TransactionGroup } from "./transaction-group.js";

export const DEFAULT_SALES_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "shift",
    label: "Shift",
    type: "select",
    options: ["Pagi", "Siang", "Malam"],
    required: true,
    width: "half",
  },
];

export const DEFAULT_EXPENSE_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "deskripsi",
    label: "Deskripsi",
    type: "text",
    required: true,
    placeholder: "Deskripsi keperluan / biaya operasional",
    width: "full",
  },
  {
    key: "jumlah",
    label: "Jumlah",
    type: "number",
    required: false,
    placeholder: "0",
    width: "half",
  },
  {
    key: "satuan",
    label: "Satuan",
    type: "text",
    required: false,
    placeholder: "pcs / unit / bulan / rim",
    width: "half",
  },
];

export const DEFAULT_PURCHASE_COD_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "nama_supplier",
    label: "Nama Supplier",
    type: "text",
    required: true,
    placeholder: "Nama distributor / supplier PBF",
    width: "full",
  },
  {
    key: "no_faktur",
    label: "No. Faktur",
    type: "text",
    required: false,
    placeholder: "Nomor faktur pembelian",
    width: "half",
  },
  {
    key: "tanggal_order",
    label: "Tanggal Order",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "total_order",
    label: "Total Order",
    type: "currency",
    required: false,
    placeholder: "0",
    width: "half",
  },
  {
    key: "tgl_terima_barang",
    label: "Tanggal Terima Barang",
    type: "date",
    required: false,
    width: "half",
  },
];

export const DEFAULT_PURCHASE_TEMPO_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "nama_supplier",
    label: "Nama Supplier",
    type: "text",
    required: true,
    placeholder: "Nama distributor / supplier PBF",
    width: "full",
  },
  {
    key: "no_faktur",
    label: "No. Faktur",
    type: "text",
    required: true,
    placeholder: "Nomor faktur distributor",
    width: "half",
  },
  {
    key: "tanggal_order",
    label: "Tanggal Order",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "total_order",
    label: "Total Order",
    type: "currency",
    required: false,
    placeholder: "0",
    width: "half",
  },
  {
    key: "tgl_terima_barang",
    label: "Tanggal Terima Barang",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "jatuh_tempo",
    label: "Waktu Jatuh Tempo",
    type: "date",
    required: true,
    width: "half",
  },
];

export type MetadataPresetTemplate = {
  id: string;
  name: string;
  description: string;
  schema: MetadataFieldDefinition[];
};

export const METADATA_PRESET_TEMPLATES: MetadataPresetTemplate[] = [
  {
    id: "penjualan",
    name: "Penjualan (Shift)",
    description: "Metadata penjualan shift tanpa nomor struk atau pesanan",
    schema: DEFAULT_SALES_METADATA_SCHEMA,
  },
  {
    id: "biaya_operasional",
    name: "Biaya Operasional",
    description: "Deskripsi keperluan, jumlah, dan satuan biaya",
    schema: DEFAULT_EXPENSE_METADATA_SCHEMA,
  },
  {
    id: "pembelian_cod",
    name: "Pembelian COD",
    description: "Tanggal order, total order, tgl terima, no faktur, nama supplier",
    schema: DEFAULT_PURCHASE_COD_METADATA_SCHEMA,
  },
  {
    id: "pembelian_tempo",
    name: "Pembelian Tempo",
    description:
      "Tanggal order, total order, tgl terima, no faktur, nama supplier, waktu jatuh tempo",
    schema: DEFAULT_PURCHASE_TEMPO_METADATA_SCHEMA,
  },
];

export type TransactionType = {
  id: string;
  name: string;
  code: string;
  debitAccountId: string;
  creditAccountId: string;
  group?: TransactionGroup;
  description?: string | null;
  metadataSchema: MetadataFieldDefinition[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TransactionRecord = {
  id: string;
  transactionDate: string;
  transactionTypeId: string;
  amount: number;
  debitAccountId: string;
  creditAccountId: string;
  memo?: string | null;
  metadata: Record<string, any>;
  journalId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionWithBalances = TransactionRecord & {
  transactionTypeName?: string;
  group?: TransactionGroup;
  debitAccountCode?: string;
  debitAccountName?: string;
  creditAccountCode?: string;
  creditAccountName?: string;
  runningBalances: Record<string, number>;
  mutations: Record<string, number>;
};

export type CashBankAccountSummary = {
  code: string;
  name: string;
  balance: number;
};

export type TransactionsSummary = {
  accounts: CashBankAccountSummary[];
  totalTransactions: number;
  totalAmount: number;
};

export type HealthResponse = {
  status: "ok";
  service: "api";
  timestamp: string;
};

export type UserRole = "admin" | "asisten";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  allowedCoaCodes: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export const SENSITIVE_COA_CODES = [
  "1108", // Saving Gaji
  "6102", // Beban gaji
  "3101", // Akun Modal
  "3201", // Laba ditahan
] as const;

export const DEFAULT_ASSISTANT_ALLOWED_COA_CODES: string[] = [
  "1101", // Uang tukaran kasir permanen
  "1102", // Tunai Kasir
  "1103", // Bank Jago Syariah
  "1104", // Saldo Penjual Shopee
  "1105", // Saldo Penjual Blibli
  "1106", // Saldo Grab Merchant
  "1107", // Saldo QRIS DANA
  "1109", // Saving Sewa
  "1201", // Dana Pending Shopee
  "1203", // Dana Pending Blibli
  "1204", // Piutang Pelanggan
  "1205", // Piutang supplier
  "1301", // Stok Barang
  "1401", // Saldo sewa dibayar dimuka
  "1601", // Aset tetap, dalam biaya
  "1699", // Akumulasi Penyusutan Aset Tetap
  "2102", // Hutang Dagang
  "2104", // Hutang konsinyasi
  "4101", // Omset
  "4201", // Pendapatan lain-lain
  "5101", // HPP
  "5102", // HPP konsinyasi
  "6101", // Beban admin transaksi
  "6103", // Beban Listrik, Air, Internet
  "6104", // Beban Perlengkapan Toko
  "6105", // Beban Promosi
  "6106", // Amortisasi sewa bangunan bulanan
  "6107", // Beban lain-lain
  "6201", // Penyusutan Aset Tetap
  "6301", // Beban Pajak
];

export type CashFlowItem = {
  accountId?: string;
  code?: string;
  name: string;
  amount: number;
};

export type CashFlowCategory = {
  key: string;
  label: string;
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  totalInflow: number;
  totalOutflow: number;
  netAmount: number;
};

export type CashAccountFlowSummary = {
  accountId: string;
  code: string;
  name: string;
  beginningBalance: number;
  inflow: number;
  outflow: number;
  netMovement: number;
  endingBalance: number;
};

export type CashFlowReport = {
  period: { startDate: string; endDate: string };
  operating: CashFlowCategory;
  investing: CashFlowCategory;
  financing: CashFlowCategory;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
  cashAccounts: CashAccountFlowSummary[];
};
